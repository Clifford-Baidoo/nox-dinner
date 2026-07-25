import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { BookingDetail } from "../lib/types";
import { useSettings } from "../lib/useSettings";
import { FloorPlan } from "../components/FloorPlan";

const POLL_MS = 4000;

export default function BookingPage() {
  const { code = "" } = useParams();
  const { settings } = useSettings();
  const eventName = settings.eventName;
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const lostSeatIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.get<BookingDetail>(`/bookings/${encodeURIComponent(code)}`);
      setDetail(data);
      setError(null);
      // Drop any locally-selected seats that just became taken by someone else.
      setSelectedOrder((prev) => {
        const takenIds = new Set(
          data.tables.flatMap((t) => t.seats.filter((s) => s.taken && !s.isMine).map((s) => s.id))
        );
        return prev.filter((id) => !takenIds.has(id));
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong loading your booking.");
      }
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detail || detail.booking.status === "revoked") return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [detail, load]);

  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const mySeats = useMemo(() => {
    if (!detail) return [];
    return detail.tables.flatMap((t) =>
      t.seats.filter((s) => s.isMine).map((s) => ({ label: s.label, table: t.name }))
    );
  }, [detail]);

  const mySeatIds = useMemo(() => {
    if (!detail) return new Set<string>();
    return new Set(detail.tables.flatMap((t) => t.seats.filter((s) => s.isMine).map((s) => s.id)));
  }, [detail]);

  function toggleSeat(seatId: string, taken: boolean) {
    if (!detail) return;
    if (taken) return;
    setConfirmError(null);
    setSelectedOrder((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((id) => id !== seatId);
      }
      const allowed = detail.booking.seatsAllowed;
      if (prev.length < allowed) {
        return [...prev, seatId];
      }
      // Deselect the oldest pick to make room for the new one.
      setHint(`You can only pick ${allowed} seat(s) — swapped out your first pick.`);
      return [...prev.slice(1), seatId];
    });
  }

  async function handleConfirm() {
    if (!detail) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await api.post(`/bookings/${encodeURIComponent(code)}/confirm`, { seatIds: selectedOrder });
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setConfirmError(err.message);
        const body = err.body as { seats?: { id: string; label: string }[] } | null;
        if (body?.seats) {
          lostSeatIds.current = new Set(body.seats.map((s) => s.id));
          setSelectedOrder((prev) => prev.filter((id) => !lostSeatIds.current.has(id)));
        }
      } else {
        setConfirmError("Something went wrong confirming your seats.");
      }
      await load();
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 2500);
    return () => clearTimeout(t);
  }, [hint]);

  if (loading) {
    return <CenteredMessage eventName={eventName}>Loading your booking…</CenteredMessage>;
  }

  if (error || !detail) {
    return (
      <CenteredMessage eventName={eventName}>
        <div className="rounded-2xl border border-red-tint-border bg-red-tint p-6">
          <p className="text-lg font-semibold text-red">We couldn't find that booking</p>
          <p className="mt-2 text-sm text-muted">{error ?? "Please check your code and try again."}</p>
        </div>
      </CenteredMessage>
    );
  }

  const { booking } = detail;

  if (booking.status === "confirmed") {
    return (
      <Shell eventName={eventName}>
        <main className="grid place-items-center px-5 py-16">
          <div className="animate-nox-up w-full min-w-0 max-w-xl">
            <div className="mx-auto max-w-[490px] rounded-[20px] border border-hairline bg-card p-10 text-center shadow-[0_24px_60px_rgba(31,45,35,0.08)]">
              <div className="mx-auto mb-5 grid h-[60px] w-[60px] place-items-center rounded-full border border-forest-tint-border bg-forest-tint text-2xl text-forest">
                ✓
              </div>
              <h1 className="mb-2.5 font-serif text-[36px] font-semibold leading-[1.15]">
                Hi {booking.guestName}, you're all set!
              </h1>
              <p className="mb-7 text-[15px] leading-relaxed text-muted">
                Your seats are held for the evening. Show this screen at the door if you need to.
              </p>
              <div className="rounded-2xl border border-hairline-soft bg-cream-soft p-6">
                <div className="mb-2.5 text-[11.5px] uppercase tracking-[0.14em] text-gold">Your seats</div>
                <div className="flex flex-col gap-2">
                  {mySeats.map((s) => (
                    <div key={s.label}>
                      <div className="font-serif text-[34px] font-semibold leading-tight tracking-wide text-forest">
                        {s.label}
                      </div>
                      <div className="text-[15px] text-ink-soft">{s.table}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-2 text-[13.5px] text-muted">
                <span>Booking code</span>
                <span className="whitespace-nowrap rounded-md border border-hairline-soft bg-cream-soft px-2 py-0.5 font-mono text-[13.5px] tracking-wider text-ink-soft">
                  {booking.code}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex flex-wrap justify-center gap-4 text-[12.5px] text-muted-soft">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-wine-deep bg-wine" />
                  Your seat
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-line-soft bg-white" />
                  Free
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-forest" />
                  Taken
                </span>
              </div>
              <FloorPlan
                tables={detail.tables}
                seatDisabled={() => true}
                centerSeatIds={mySeatIds}
                maxHeight="70vh"
              />
            </div>
          </div>
        </main>
      </Shell>
    );
  }

  const remaining = booking.seatsAllowed - selectedOrder.length;

  return (
    <Shell eventName={eventName}>
      <div className="mx-auto min-h-screen max-w-md pb-28">
        <div className="px-4 pt-8 text-center">
          <h1 className="font-serif text-2xl font-semibold">
            Hi {booking.guestName}, you can pick {booking.seatsAllowed} seat{booking.seatsAllowed > 1 ? "s" : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">Tap an open seat to claim it.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-[12.5px] text-muted-soft">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border border-wine-deep bg-wine" />
              Your pick
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border border-line-soft bg-white" />
              Free
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-forest" />
              Taken
            </span>
          </div>
        </div>

        {hint && (
          <div className="mx-4 mt-3 rounded-lg border border-gold-tint-border bg-gold-tint px-3 py-2 text-center text-xs text-gold-deep">
            {hint}
          </div>
        )}
        {confirmError && (
          <div className="mx-4 mt-3 rounded-lg border border-red-tint-border bg-red-tint px-3 py-2 text-center text-xs text-red">
            {confirmError}
          </div>
        )}

        <div className="mt-4 px-4">
          <FloorPlan
            tables={detail.tables}
            selectedSeatIds={selectedSet}
            onSeatClick={(seat) => toggleSeat(seat.id, seat.taken)}
            maxHeight="55vh"
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">
              {selectedOrder.length} of {booking.seatsAllowed} selected
              {remaining > 0 ? ` — pick ${remaining} more` : ""}
            </span>
            <button
              type="button"
              disabled={selectedOrder.length !== booking.seatsAllowed || confirming}
              onClick={handleConfirm}
              className="rounded-xl bg-forest px-5 py-2.5 font-medium tracking-wide text-white transition-colors hover:bg-forest-hover disabled:cursor-not-allowed disabled:bg-[#c3ccc5] disabled:text-white/80"
            >
              {confirming ? "Confirming…" : "Confirm seats"}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, eventName }: { children: React.ReactNode; eventName: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-soft to-cream">
      <div className="flex h-16 items-center justify-center border-b border-hairline bg-white/95">
        <span className="font-serif text-[15px] uppercase tracking-[0.3em] text-gold">{eventName}</span>
      </div>
      {children}
    </div>
  );
}

function CenteredMessage({ children, eventName }: { children: React.ReactNode; eventName: string }) {
  return (
    <Shell eventName={eventName}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        {children}
      </div>
    </Shell>
  );
}
