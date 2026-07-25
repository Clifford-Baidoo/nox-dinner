import { prisma } from "./db.js";

export class SeatConflictError extends Error {
  seats: { id: string; label: string }[];
  constructor(seats: { id: string; label: string }[]) {
    super("Some seats were just taken");
    this.seats = seats;
  }
}

export class BookingNotPendingError extends Error {
  constructor() {
    super("Booking is no longer pending");
  }
}

/**
 * Assigns the given seats to the booking inside a single transaction.
 * Relies on the UNIQUE constraint on SeatAssignment.seatId as the
 * double-booking guard: if any seat was taken between the availability
 * check and this call, the unique constraint violation rolls back the
 * whole transaction and we report exactly which seats were lost.
 *
 * Also re-checks the booking's status inside the transaction so two
 * concurrent confirm requests for the same booking can't both succeed.
 */
export async function confirmBookingSeats(bookingId: string, seatIds: string[]) {
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: "pending" },
        data: { status: "confirmed", confirmedAt: new Date() },
      });
      if (updated.count === 0) {
        throw new BookingNotPendingError();
      }
      await tx.seatAssignment.createMany({
        data: seatIds.map((seatId) => ({ seatId, bookingId })),
      });
    });
  } catch (err) {
    if (err instanceof BookingNotPendingError) throw err;
    const takenAssignments = await prisma.seatAssignment.findMany({
      where: { seatId: { in: seatIds } },
      include: { seat: true },
    });
    throw new SeatConflictError(
      takenAssignments.map((a) => ({ id: a.seat.id, label: a.seat.label }))
    );
  }
}
