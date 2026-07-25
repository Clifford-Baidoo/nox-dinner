import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { TableWithSeats } from "../../lib/types";
import { FloorPlan } from "../../components/FloorPlan";

type DashboardSeat = TableWithSeats["seats"][number] & { code?: string };
type DashboardTable = TableWithSeats & { seats: DashboardSeat[] };

const REFRESH_MS = 5000;

export default function AdminSeatMap() {
  const [tables, setTables] = useState<DashboardTable[]>([]);
  const [selected, setSelected] = useState<DashboardSeat | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await api.get<DashboardTable[]>("/admin/seatmap");
      if (!cancelled) setTables(data);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const total = tables.reduce((sum, t) => sum + t.seats.length, 0);
  const taken = tables.reduce((sum, t) => sum + t.seats.filter((s) => s.taken).length, 0);
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h1 className="font-serif text-3xl font-semibold text-ink">Live Map</h1>
        <div className="flex items-center gap-4 rounded-2xl border border-hairline bg-card px-5 py-3.5 shadow-[0_1px_2px_rgba(31,29,26,0.03)]">
          <div>
            <div className="font-serif text-[28px] font-semibold leading-none text-forest">
              {taken} / {total}
            </div>
            <div className="mt-1 text-[12px] text-muted">seats taken · refreshes every 5s</div>
          </div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-hairline-soft">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3f8f63] shadow-[0_0_0_4px_var(--color-forest-ring)]" />
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-gold-tint-border bg-gold-tint px-4 py-2 text-sm">
          <span className="font-semibold text-gold-deep">{selected.label}</span>{" "}
          {selected.taken ? (
            <span className="text-ink-soft">
              — {selected.guestName} ({selected.code})
            </span>
          ) : (
            <span className="text-muted-soft">— free</span>
          )}
        </div>
      )}

      <FloorPlan
        tables={tables}
        seatDisabled={() => false}
        seatColorClass={(seat) =>
          seat.taken ? "border-forest bg-forest text-forest-ink" : "border-line-soft bg-white text-muted-soft"
        }
        onSeatClick={(seat) => setSelected(seat as DashboardSeat)}
        maxHeight="70vh"
      />
    </div>
  );
}
