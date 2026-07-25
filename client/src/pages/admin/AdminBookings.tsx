import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { TableWithSeats } from "../../lib/types";
import { FloorPlan } from "../../components/FloorPlan";

interface AdminBooking {
  id: string;
  code: string;
  guestName: string;
  phone: string | null;
  seatsAllowed: number;
  status: "pending" | "confirmed" | "revoked";
  seats: { label: string; table: string }[];
}

interface CreatedBooking extends AdminBooking {
  url: string;
  qr: string;
}

const statusStyles: Record<string, { pill: string }> = {
  pending: { pill: "border-gold-tint-border bg-gold-tint text-gold-deep" },
  confirmed: { pill: "border-forest-tint-border bg-forest-tint text-forest" },
  revoked: { pill: "border-line-soft bg-cream-soft text-muted-soft" },
};

const inputClass =
  "rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:bg-white focus:shadow-[0_0_0_3px_var(--color-forest-ring)]";
const labelClass = "text-[11px] font-medium uppercase tracking-wide text-muted";
const outlineBtn =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink-soft hover:border-muted-faint hover:bg-cream";

export default function AdminBookings() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [seatsAllowed, setSeatsAllowed] = useState(2);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedBooking | null>(null);

  const [editing, setEditing] = useState<Record<string, { guestName: string; phone: string; seatsAllowed: number }>>({});
  const [assigning, setAssigning] = useState<AdminBooking | null>(null);
  const [qrModal, setQrModal] = useState<{ code: string; url: string; qr: string } | null>(null);

  async function load(q = search) {
    const data = await api.get<AdminBooking[]>(`/admin/bookings${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setBookings(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await api.post<CreatedBooking>("/admin/bookings", { guestName, phone, seatsAllowed });
      setJustCreated(created);
      setGuestName("");
      setPhone("");
      setSeatsAllowed(2);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create booking");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this booking? Any assigned seats will be freed.")) return;
    await api.post(`/admin/bookings/${id}/revoke`);
    await load();
  }

  async function handleReset(id: string) {
    if (!confirm("Clear this booking's seats and set it back to pending?")) return;
    await api.post(`/admin/bookings/${id}/reset`);
    await load();
  }

  async function handleSaveEdit(id: string) {
    const edit = editing[id];
    if (!edit) return;
    try {
      await api.put(`/admin/bookings/${id}`, {
        guestName: edit.guestName,
        phone: edit.phone,
        seatsAllowed: edit.seatsAllowed,
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update booking");
    }
  }

  async function openQr(id: string) {
    const data = await api.get<{ url: string; qr: string; code: string }>(`/admin/bookings/${id}/qr`);
    setQrModal(data);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold text-ink">Bookings</h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgba(31,29,26,0.03)]"
      >
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Guest name</label>
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Seats allowed</label>
          <input
            type="number"
            min={1}
            max={50}
            value={seatsAllowed}
            onChange={(e) => setSeatsAllowed(Number(e.target.value))}
            className={`w-24 ${inputClass}`}
          />
        </div>
        <button
          disabled={creating}
          type="submit"
          className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-hover disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create booking"}
        </button>
      </form>
      {error && <p className="text-sm text-red">{error}</p>}

      {justCreated && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold-tint-border bg-gold-tint p-4">
          <img src={justCreated.qr} alt="QR code" className="h-32 w-32 rounded-lg bg-white p-1" />
          <div>
            <p className="font-serif text-lg font-semibold text-gold-deep">{justCreated.code}</p>
            <p className="text-sm text-ink-soft">
              {justCreated.guestName} · {justCreated.seatsAllowed} seat(s)
            </p>
            <a href={justCreated.url} target="_blank" rel="noreferrer" className="text-xs text-forest underline break-all">
              {justCreated.url}
            </a>
            <div className="mt-2 flex gap-2">
              <a
                href={justCreated.qr}
                download={`${justCreated.code}.png`}
                className="rounded-lg border border-gold-tint-border bg-white px-3 py-1.5 text-xs text-gold-deep hover:bg-cream"
              >
                Download QR
              </a>
              <button onClick={() => setJustCreated(null)} className="rounded-lg px-3 py-1.5 text-xs text-muted">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
          placeholder="Search by name, code, or phone"
          className={`w-full max-w-sm ${inputClass} py-2.5`}
        />
        <a href="/api/admin/export.csv" className={outlineBtn + " py-2.5 whitespace-nowrap"}>
          Export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {bookings.map((b) => {
            const edit = editing[b.id];
            const style = statusStyles[b.status];
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgba(31,29,26,0.03)]"
              >
                {edit ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <input
                      value={edit.guestName}
                      onChange={(e) => setEditing((p) => ({ ...p, [b.id]: { ...edit, guestName: e.target.value } }))}
                      className={inputClass}
                    />
                    <input
                      value={edit.phone}
                      onChange={(e) => setEditing((p) => ({ ...p, [b.id]: { ...edit, phone: e.target.value } }))}
                      placeholder="Phone"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={b.status !== "pending"}
                      value={edit.seatsAllowed}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, [b.id]: { ...edit, seatsAllowed: Number(e.target.value) } }))
                      }
                      className={`w-24 ${inputClass} disabled:opacity-50`}
                    />
                    <button
                      onClick={() => handleSaveEdit(b.id)}
                      className="rounded-lg bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-hover"
                    >
                      Save
                    </button>
                    <button
                      onClick={() =>
                        setEditing((p) => {
                          const next = { ...p };
                          delete next[b.id];
                          return next;
                        })
                      }
                      className="rounded-lg px-3 py-2 text-sm text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="whitespace-nowrap rounded-md border border-hairline-soft bg-cream-soft px-2 py-0.5 font-mono text-[13px] tracking-wide text-ink-soft">
                          {b.code}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${style.pill}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="font-serif text-xl font-semibold text-ink">{b.guestName}</p>
                      <p className="text-xs text-muted">
                        {b.phone ?? "no phone"} · {b.seatsAllowed} seat(s) allowed
                        {b.seats.length > 0 && ` · ${b.seats.map((s) => s.label).join(", ")}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openQr(b.id)} className={outlineBtn}>
                        QR
                      </button>
                      <button
                        onClick={() =>
                          setEditing((p) => ({
                            ...p,
                            [b.id]: { guestName: b.guestName, phone: b.phone ?? "", seatsAllowed: b.seatsAllowed },
                          }))
                        }
                        className={outlineBtn}
                      >
                        Edit
                      </button>
                      {b.status === "pending" && (
                        <button
                          onClick={() => setAssigning(b)}
                          className="rounded-lg border border-forest-tint-border bg-forest-tint px-3 py-1.5 text-xs font-medium text-forest hover:bg-[#e3ece4]"
                        >
                          Assign seats
                        </button>
                      )}
                      {b.status === "confirmed" && (
                        <button onClick={() => handleReset(b.id)} className={outlineBtn}>
                          Clear seats
                        </button>
                      )}
                      {b.status !== "revoked" && (
                        <button
                          onClick={() => handleRevoke(b.id)}
                          className="rounded-lg border border-red-tint-border bg-white px-3 py-1.5 text-xs text-red hover:bg-red-tint"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {bookings.length === 0 && <p className="text-sm text-muted">No bookings found.</p>}
        </div>
      )}

      {qrModal && (
        <Modal onClose={() => setQrModal(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <img src={qrModal.qr} alt="QR code" className="h-56 w-56 rounded-lg bg-white p-2" />
            <p className="font-serif text-xl font-semibold text-gold-deep">{qrModal.code}</p>
            <a href={qrModal.url} target="_blank" rel="noreferrer" className="text-xs text-forest underline break-all">
              {qrModal.url}
            </a>
            <a
              href={qrModal.qr}
              download={`${qrModal.code}.png`}
              className="rounded-lg border border-gold-tint-border bg-white px-3 py-1.5 text-xs text-gold-deep hover:bg-cream"
            >
              Download QR
            </a>
          </div>
        </Modal>
      )}

      {assigning && (
        <AssignSeatsModal
          booking={assigning}
          onClose={() => setAssigning(null)}
          onDone={async () => {
            setAssigning(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-hairline bg-card p-6 shadow-[0_24px_60px_rgba(31,45,35,0.12)]"
      >
        {children}
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-line py-2 text-sm text-ink-soft hover:bg-cream">
          Close
        </button>
      </div>
    </div>
  );
}

function AssignSeatsModal({
  booking,
  onClose,
  onDone,
}: {
  booking: AdminBooking;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tables, setTables] = useState<TableWithSeats[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<TableWithSeats[]>("/admin/tables").then(setTables);
  }, []);

  function toggle(seatId: string, taken: boolean) {
    if (taken) return;
    setSelected((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId);
      if (prev.length >= booking.seatsAllowed) return [...prev.slice(1), seatId];
      return [...prev, seatId];
    });
  }

  async function handleAssign() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/bookings/${booking.id}/assign`, { seatIds: selected });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign seats");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-card p-4 shadow-[0_24px_60px_rgba(31,45,35,0.12)]"
      >
        <p className="mb-1 font-serif text-lg font-semibold text-ink">
          Assign {booking.seatsAllowed} seat(s) to {booking.guestName}
        </p>
        <p className="mb-3 text-xs text-muted">
          {selected.length} of {booking.seatsAllowed} selected
        </p>
        {error && <p className="mb-2 text-sm text-red">{error}</p>}
        <FloorPlan
          tables={tables}
          selectedSeatIds={new Set(selected)}
          onSeatClick={(seat) => toggle(seat.id, seat.taken)}
          maxHeight="45vh"
        />
        <div className="mt-4 flex gap-2">
          <button
            disabled={selected.length !== booking.seatsAllowed || submitting}
            onClick={handleAssign}
            className="flex-1 rounded-lg bg-forest py-2 text-sm font-medium text-white hover:bg-forest-hover disabled:opacity-50"
          >
            {submitting ? "Assigning…" : "Assign"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:bg-cream">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
