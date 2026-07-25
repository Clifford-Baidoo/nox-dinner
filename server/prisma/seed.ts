import { PrismaClient } from "@prisma/client";
import { seatLabel } from "../src/lib/tableLabels.js";
import { generateUniqueCode } from "../src/lib/code.js";

const prisma = new PrismaClient();

// Lays out a banquet hall: a square head table up front, 15 round tables in
// a 5x3 grid, and two long rectangular tables along the back wall.
const GRID_COLUMNS = 5;
const GRID_SPACING = 190;
const GRID_ORIGIN_X = 140;
const GRID_ORIGIN_Y = 280;
const HEAD_TABLE_POS = { x: 520, y: 110 };
const LONG_TABLE_POSITIONS = [
  { x: 520, y: 900 },
  { x: 520, y: 1180 },
];

async function main() {
  console.log("Clearing existing data...");
  await prisma.seatAssignment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.table.deleteMany();

  let sortOrder = 0;
  const allSeatIds: string[] = [];

  console.log("Creating square head table (8 seats)...");
  {
    const name = "Head Table";
    const table = await prisma.table.create({
      data: {
        name,
        sortOrder: sortOrder++,
        shape: "square",
        x: HEAD_TABLE_POS.x,
        y: HEAD_TABLE_POS.y,
        seatCount: 8,
        seats: {
          create: Array.from({ length: 8 }, (_, i2) => ({ label: seatLabel(name, i2 + 1) })),
        },
      },
      include: { seats: true },
    });
    allSeatIds.push(...table.seats.map((s) => s.id));
  }

  console.log("Creating 15 round tables of 10, arranged in a 5x3 grid...");
  for (let i = 0; i < 15; i++) {
    const name = `Table ${i + 1}`;
    const col = i % GRID_COLUMNS;
    const row = Math.floor(i / GRID_COLUMNS);
    const table = await prisma.table.create({
      data: {
        name,
        sortOrder: sortOrder++,
        shape: "round",
        x: GRID_ORIGIN_X + col * GRID_SPACING,
        y: GRID_ORIGIN_Y + row * GRID_SPACING,
        seatCount: 10,
        seats: {
          create: Array.from({ length: 10 }, (_, i2) => ({ label: seatLabel(name, i2 + 1) })),
        },
      },
      include: { seats: true },
    });
    allSeatIds.push(...table.seats.map((s) => s.id));
  }

  console.log("Creating 2 long rectangular tables of 20 along the back wall...");
  for (const [i, name] of ["Long Table A", "Long Table B"].entries()) {
    await prisma.table.create({
      data: {
        name,
        sortOrder: sortOrder++,
        shape: "rectangle",
        x: LONG_TABLE_POSITIONS[i].x,
        y: LONG_TABLE_POSITIONS[i].y,
        seatCount: 20,
        seats: {
          create: Array.from({ length: 20 }, (_, i2) => ({ label: seatLabel(name, i2 + 1) })),
        },
      },
    });
  }

  console.log("Creating 5 sample bookings...");
  const sampleGuests: { guestName: string; phone?: string; seatsAllowed: number; confirm?: boolean }[] = [
    { guestName: "Ama Owusu", phone: "0244000001", seatsAllowed: 2, confirm: true },
    { guestName: "Kwame Mensah", phone: "0244000002", seatsAllowed: 4, confirm: true },
    { guestName: "Efua Boateng", seatsAllowed: 1, confirm: false },
    { guestName: "Kojo Asante", phone: "0244000004", seatsAllowed: 6, confirm: false },
    { guestName: "Abena Sarpong", seatsAllowed: 3, confirm: false },
  ];

  let seatCursor = 0;
  for (const guest of sampleGuests) {
    const code = await generateUniqueCode();
    const booking = await prisma.booking.create({
      data: {
        code,
        guestName: guest.guestName,
        phone: guest.phone ?? null,
        seatsAllowed: guest.seatsAllowed,
      },
    });
    console.log(`  ${guest.guestName}: ${code} (${guest.seatsAllowed} seat(s)${guest.confirm ? ", confirmed" : ""})`);

    if (guest.confirm) {
      const seatIds = allSeatIds.slice(seatCursor, seatCursor + guest.seatsAllowed);
      seatCursor += guest.seatsAllowed;
      await prisma.$transaction([
        prisma.seatAssignment.createMany({
          data: seatIds.map((seatId) => ({ seatId, bookingId: booking.id })),
        }),
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "confirmed", confirmedAt: new Date() },
        }),
      ]);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
