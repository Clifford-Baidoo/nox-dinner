import { Router } from "express";
import { prisma } from "../lib/db.js";
import { confirmBookingSeats, SeatConflictError, BookingNotPendingError } from "../lib/booking.js";

export const publicRouter = Router();

publicRouter.get("/settings", (_req, res) => {
  res.json({ eventName: process.env.EVENT_NAME || "Dinner Event" });
});

publicRouter.get("/bookings/:code", async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const booking = await prisma.booking.findUnique({ where: { code } });
  if (!booking) {
    res.status(404).json({ error: "We couldn't find a booking with that code." });
    return;
  }
  if (booking.status === "revoked") {
    res.status(410).json({ error: "This booking has been cancelled. Please contact the host." });
    return;
  }

  const tables = await prisma.table.findMany({
    orderBy: { sortOrder: "asc" },
    include: { seats: { include: { assignment: true } } },
  });

  res.json({
    booking: {
      code: booking.code,
      guestName: booking.guestName,
      seatsAllowed: booking.seatsAllowed,
      status: booking.status,
    },
    tables: tables.map((table) => ({
      id: table.id,
      name: table.name,
      shape: table.shape,
      x: table.x,
      y: table.y,
      seats: table.seats.map((seat) => ({
        id: seat.id,
        label: seat.label,
        taken: Boolean(seat.assignment),
        isMine: seat.assignment?.bookingId === booking.id,
        dx: seat.dx,
        dy: seat.dy,
      })),
    })),
  });
});

publicRouter.post("/bookings/:code/confirm", async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const seatIds: unknown = req.body?.seatIds;

  if (!Array.isArray(seatIds) || seatIds.some((s) => typeof s !== "string") || seatIds.length === 0) {
    res.status(400).json({ error: "seatIds must be a non-empty array of seat ids." });
    return;
  }
  const uniqueSeatIds = Array.from(new Set(seatIds as string[]));

  const booking = await prisma.booking.findUnique({ where: { code } });
  if (!booking) {
    res.status(404).json({ error: "We couldn't find a booking with that code." });
    return;
  }
  if (booking.status === "revoked") {
    res.status(410).json({ error: "This booking has been cancelled. Please contact the host." });
    return;
  }
  if (booking.status === "confirmed") {
    res.status(409).json({ error: "This booking is already confirmed." });
    return;
  }
  // Never trust the client's seatsAllowed — validate against the stored booking.
  if (uniqueSeatIds.length !== booking.seatsAllowed) {
    res.status(400).json({ error: `Please select exactly ${booking.seatsAllowed} seat(s).` });
    return;
  }

  const seats = await prisma.seat.findMany({ where: { id: { in: uniqueSeatIds } } });
  if (seats.length !== uniqueSeatIds.length) {
    res.status(400).json({ error: "One or more selected seats are invalid." });
    return;
  }

  try {
    await confirmBookingSeats(booking.id, uniqueSeatIds);
  } catch (err) {
    if (err instanceof SeatConflictError) {
      res.status(409).json({
        error: "Some of the seats you picked were just taken by someone else. Please choose again.",
        seats: err.seats,
      });
      return;
    }
    if (err instanceof BookingNotPendingError) {
      res.status(409).json({ error: "This booking is no longer pending." });
      return;
    }
    throw err;
  }

  res.json({ ok: true });
});
