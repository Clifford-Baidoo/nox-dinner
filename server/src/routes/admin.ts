import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAdmin, SESSION_COOKIE } from "../lib/auth.js";
import { generateUniqueCode } from "../lib/code.js";
import { seatLabel } from "../lib/tableLabels.js";
import { defaultTablePosition } from "../lib/layout.js";
import { isTableShape } from "../lib/shapes.js";
import { confirmBookingSeats, SeatConflictError, BookingNotPendingError } from "../lib/booking.js";
import { getHost, bookingUrl, qrPngDataUrl } from "../lib/qr.js";

export const adminRouter = Router();

// ---- Auth ----

adminRouter.post("/login", (req, res) => {
  const { password } = req.body ?? {};
  if (!process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: "Server is missing ADMIN_PASSWORD configuration." });
    return;
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }
  res.cookie(SESSION_COOKIE, "ok", {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12,
  });
  res.json({ ok: true });
});

adminRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

adminRouter.get("/me", (req, res) => {
  res.json({ authenticated: req.signedCookies?.[SESSION_COOKIE] === "ok" });
});

adminRouter.use(requireAdmin);

// ---- Tables (layout builder) ----

adminRouter.get("/tables", async (_req, res) => {
  const tables = await prisma.table.findMany({
    orderBy: { sortOrder: "asc" },
    include: { seats: { include: { assignment: true } } },
  });
  res.json(
    tables.map((t) => ({
      id: t.id,
      name: t.name,
      sortOrder: t.sortOrder,
      shape: t.shape,
      x: t.x,
      y: t.y,
      seatCount: t.seatCount,
      seats: t.seats.map((s) => ({ id: s.id, label: s.label, taken: Boolean(s.assignment) })),
    }))
  );
});

adminRouter.post("/tables", async (req, res) => {
  const { name, seatCount, shape, x, y } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const count = Number(seatCount);
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    res.status(400).json({ error: "seatCount must be an integer between 1 and 200" });
    return;
  }
  const tableShape = isTableShape(shape) ? shape : "round";
  const maxSort = await prisma.table.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  const tableCount = await prisma.table.count();
  const defaultPos = defaultTablePosition(tableCount);

  const table = await prisma.table.create({
    data: {
      name: name.trim(),
      seatCount: count,
      sortOrder,
      shape: tableShape,
      x: typeof x === "number" ? x : defaultPos.x,
      y: typeof y === "number" ? y : defaultPos.y,
      seats: {
        create: Array.from({ length: count }, (_, i) => ({ label: seatLabel(name.trim(), i + 1) })),
      },
    },
    include: { seats: true },
  });
  res.status(201).json(table);
});

adminRouter.put("/tables/:id", async (req, res) => {
  const table = await prisma.table.findUnique({
    where: { id: req.params.id },
    include: { seats: { include: { assignment: true } } },
  });
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  const { name, seatCount, sortOrder, shape, x, y } = req.body ?? {};
  const newName = typeof name === "string" && name.trim() ? name.trim() : table.name;
  const data: Record<string, unknown> = { name: newName };
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;
  if (isTableShape(shape)) data.shape = shape;
  if (typeof x === "number" || x === null) data.x = x;
  if (typeof y === "number" || y === null) data.y = y;

  if (seatCount !== undefined) {
    const count = Number(seatCount);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      res.status(400).json({ error: "seatCount must be an integer between 1 and 200" });
      return;
    }
    if (count > table.seatCount) {
      await prisma.seat.createMany({
        data: Array.from({ length: count - table.seatCount }, (_, i) => ({
          tableId: table.id,
          label: seatLabel(newName, table.seatCount + i + 1),
        })),
      });
    } else if (count < table.seatCount) {
      const seatsToRemove = table.seats
        .filter((s) => {
          const n = Number(s.label.split("-").pop());
          return Number.isFinite(n) && n > count;
        })
        .sort((a, b) => Number(b.label.split("-").pop()) - Number(a.label.split("-").pop()));
      const blocked = seatsToRemove.find((s) => s.assignment);
      if (blocked) {
        res.status(409).json({ error: `Cannot shrink table: seat ${blocked.label} is already booked.` });
        return;
      }
      await prisma.seat.deleteMany({ where: { id: { in: seatsToRemove.map((s) => s.id) } } });
    }
    data.seatCount = count;
  }

  const updated = await prisma.table.update({
    where: { id: table.id },
    data,
    include: { seats: { include: { assignment: true } } },
  });
  res.json(updated);
});

adminRouter.delete("/tables/:id", async (req, res) => {
  const table = await prisma.table.findUnique({
    where: { id: req.params.id },
    include: { seats: { include: { assignment: true } } },
  });
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }
  if (table.seats.some((s) => s.assignment)) {
    res.status(409).json({ error: "Cannot delete a table with booked seats. Reassign or revoke those bookings first." });
    return;
  }
  await prisma.table.delete({ where: { id: table.id } });
  res.json({ ok: true });
});

// ---- Bookings ----

adminRouter.get("/bookings", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const bookings = await prisma.booking.findMany({
    where: search
      ? {
          OR: [
            { guestName: { contains: search } },
            { code: { contains: search.toUpperCase() } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { assignments: { include: { seat: { include: { table: true } } } } },
  });
  res.json(
    bookings.map((b) => ({
      id: b.id,
      code: b.code,
      guestName: b.guestName,
      phone: b.phone,
      seatsAllowed: b.seatsAllowed,
      status: b.status,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt,
      seats: b.assignments.map((a) => ({ label: a.seat.label, table: a.seat.table.name })),
    }))
  );
});

adminRouter.post("/bookings", async (req, res) => {
  const { guestName, phone, seatsAllowed } = req.body ?? {};
  if (typeof guestName !== "string" || !guestName.trim()) {
    res.status(400).json({ error: "guestName is required" });
    return;
  }
  const count = Number(seatsAllowed);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    res.status(400).json({ error: "seatsAllowed must be an integer between 1 and 50" });
    return;
  }
  const code = await generateUniqueCode();
  const booking = await prisma.booking.create({
    data: {
      code,
      guestName: guestName.trim(),
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      seatsAllowed: count,
    },
  });
  const host = getHost(req);
  const url = bookingUrl(host, booking.code);
  const qr = await qrPngDataUrl(url);
  res.status(201).json({ ...booking, url, qr });
});

adminRouter.put("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const { guestName, phone, seatsAllowed } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (typeof guestName === "string" && guestName.trim()) data.guestName = guestName.trim();
  if (phone !== undefined) data.phone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
  if (seatsAllowed !== undefined) {
    if (booking.status !== "pending") {
      res.status(409).json({ error: "Cannot change seatsAllowed after the booking is confirmed. Reset it first." });
      return;
    }
    const count = Number(seatsAllowed);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      res.status(400).json({ error: "seatsAllowed must be an integer between 1 and 50" });
      return;
    }
    data.seatsAllowed = count;
  }
  const updated = await prisma.booking.update({ where: { id: booking.id }, data });
  res.json(updated);
});

adminRouter.post("/bookings/:id/revoke", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  await prisma.$transaction([
    prisma.seatAssignment.deleteMany({ where: { bookingId: booking.id } }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "revoked" } }),
  ]);
  res.json({ ok: true });
});

// Clears a confirmed booking's seats and returns it to pending, so it can be reassigned.
adminRouter.post("/bookings/:id/reset", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.status === "revoked") {
    res.status(409).json({ error: "Cannot reset a revoked booking." });
    return;
  }
  await prisma.$transaction([
    prisma.seatAssignment.deleteMany({ where: { bookingId: booking.id } }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "pending", confirmedAt: null } }),
  ]);
  res.json({ ok: true });
});

// Admin manually assigns specific seats to a (pending) booking.
adminRouter.post("/bookings/:id/assign", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.status !== "pending") {
    res.status(409).json({ error: "Booking is not pending. Reset it first to reassign seats." });
    return;
  }
  const seatIds: unknown = req.body?.seatIds;
  if (!Array.isArray(seatIds) || seatIds.some((s) => typeof s !== "string") || seatIds.length === 0) {
    res.status(400).json({ error: "seatIds must be a non-empty array" });
    return;
  }
  const uniqueSeatIds = Array.from(new Set(seatIds as string[]));
  if (uniqueSeatIds.length !== booking.seatsAllowed) {
    res.status(400).json({ error: `This booking is allowed exactly ${booking.seatsAllowed} seat(s).` });
    return;
  }
  try {
    await confirmBookingSeats(booking.id, uniqueSeatIds);
  } catch (err) {
    if (err instanceof SeatConflictError) {
      res.status(409).json({ error: "Some seats are already taken.", seats: err.seats });
      return;
    }
    if (err instanceof BookingNotPendingError) {
      res.status(409).json({ error: "Booking is no longer pending." });
      return;
    }
    throw err;
  }
  res.json({ ok: true });
});

adminRouter.get("/bookings/:id/qr", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const host = getHost(req);
  const url = bookingUrl(host, booking.code);
  const qr = await qrPngDataUrl(url);
  res.json({ url, qr, code: booking.code });
});

// All pending bookings' QR codes, for the bulk print view.
adminRouter.get("/print-batch", async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  const host = getHost(req);
  const withQr = await Promise.all(
    bookings.map(async (b) => ({
      code: b.code,
      guestName: b.guestName,
      seatsAllowed: b.seatsAllowed,
      qr: await qrPngDataUrl(bookingUrl(host, b.code)),
    }))
  );
  res.json(withQr);
});

// ---- Live seat map ----

adminRouter.get("/seatmap", async (_req, res) => {
  const tables = await prisma.table.findMany({
    orderBy: { sortOrder: "asc" },
    include: { seats: { include: { assignment: { include: { booking: true } } } } },
  });
  res.json(
    tables.map((t) => ({
      id: t.id,
      name: t.name,
      shape: t.shape,
      x: t.x,
      y: t.y,
      seats: t.seats.map((s) => ({
        id: s.id,
        label: s.label,
        taken: Boolean(s.assignment),
        guestName: s.assignment?.booking.guestName,
        code: s.assignment?.booking.code,
      })),
    }))
  );
});

// ---- Export ----

adminRouter.get("/export.csv", async (_req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: "confirmed" },
    orderBy: { guestName: "asc" },
    include: { assignments: { include: { seat: { include: { table: true } } } } },
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [["guestName", "phone", "code", "seatLabels", "tableNames"].join(",")];
  for (const b of bookings) {
    const seatLabels = b.assignments.map((a) => a.seat.label).join("; ");
    const tableNames = Array.from(new Set(b.assignments.map((a) => a.seat.table.name))).join("; ");
    rows.push(
      [escape(b.guestName), escape(b.phone ?? ""), escape(b.code), escape(seatLabels), escape(tableNames)].join(",")
    );
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=dinnerseats-export.csv");
  res.send(rows.join("\n"));
});
