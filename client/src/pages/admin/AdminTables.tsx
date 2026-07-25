import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { TableShape, TableWithSeats } from "../../lib/types";
import { FloorPlan } from "../../components/FloorPlan";

type AdminTable = TableWithSeats & { seatCount: number };

const SHAPE_LABELS: Record<TableShape, string> = {
  round: "Round table",
  square: "Square table",
  rectangle: "Rectangular table",
};

const inputClass =
  "rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:bg-white focus:shadow-[0_0_0_3px_var(--color-forest-ring)]";
const labelClass = "text-[11px] font-medium uppercase tracking-wide text-muted";
const outlineBtn =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:border-muted-faint hover:bg-cream";

export default function AdminTables() {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState(10);
  const [shape, setShape] = useState<TableShape>("round");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { name: string; seatCount: number; shape: TableShape }>>({});

  async function load() {
    const data = await api.get<AdminTable[]>("/admin/tables");
    setTables(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/tables", { name, seatCount, shape });
      setName("");
      setSeatCount(10);
      setShape("round");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create table");
    }
  }

  async function handleSave(id: string) {
    const edit = editing[id];
    if (!edit) return;
    setError(null);
    try {
      await api.put(`/admin/tables/${id}`, { name: edit.name, seatCount: edit.seatCount, shape: edit.shape });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update table");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this table and all its seats?")) return;
    setError(null);
    try {
      await api.del(`/admin/tables/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete table");
    }
  }

  async function handleMove(id: string, x: number, y: number) {
    try {
      await api.put(`/admin/tables/${id}`, { x, y });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move table");
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold text-ink">Layout Builder</h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgba(31,29,26,0.03)]"
      >
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Table / row name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table 16"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Shape</label>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as TableShape)}
            className={inputClass}
          >
            <option value="round">Round table</option>
            <option value="square">Square table</option>
            <option value="rectangle">Rectangular table</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Seats</label>
          <input
            type="number"
            min={1}
            max={200}
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className={`w-24 ${inputClass}`}
          />
        </div>
        <button type="submit" className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-hover">
          Add table
        </button>
      </form>
      {error && <p className="text-sm text-red">{error}</p>}

      <div>
        <p className="mb-2 text-sm text-muted">
          Drag tables below to match your venue's real layout. Positions save automatically.
        </p>
        <div className="mb-3 flex flex-wrap gap-5 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-line-soft bg-white" />
            Free seat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-forest" />
            Occupied
          </span>
        </div>
        <FloorPlan
          tables={tables}
          seatDisabled={() => true}
          seatColorClass={(seat) =>
            seat.taken ? "border-forest bg-forest text-forest-ink" : "border-line-soft bg-white text-muted-soft"
          }
          editablePositions
          onTableMove={handleMove}
          maxHeight="65vh"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {tables.map((t) => {
          const edit = editing[t.id];
          const takenCount = t.seats.filter((s) => s.taken).length;
          return (
            <div key={t.id} className="rounded-2xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgba(31,29,26,0.03)]">
              {edit ? (
                <div className="flex flex-wrap items-end gap-3">
                  <input
                    value={edit.name}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [t.id]: { ...edit, name: e.target.value } }))}
                    className={inputClass}
                  />
                  <select
                    value={edit.shape}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [t.id]: { ...edit, shape: e.target.value as TableShape } }))
                    }
                    className={inputClass}
                  >
                    <option value="round">Round table</option>
                    <option value="square">Square table</option>
                    <option value="rectangle">Rectangular table</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={edit.seatCount}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [t.id]: { ...edit, seatCount: Number(e.target.value) } }))
                    }
                    className={`w-24 ${inputClass}`}
                  />
                  <button
                    onClick={() => handleSave(t.id)}
                    className="rounded-lg bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-hover"
                  >
                    Save
                  </button>
                  <button
                    onClick={() =>
                      setEditing((prev) => {
                        const next = { ...prev };
                        delete next[t.id];
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
                  <div>
                    <p className="font-serif text-lg font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-muted">
                      {SHAPE_LABELS[t.shape]} · {t.seatCount} seats · {takenCount} taken
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditing((prev) => ({
                          ...prev,
                          [t.id]: { name: t.name, seatCount: t.seatCount, shape: t.shape },
                        }))
                      }
                      className={outlineBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg border border-red-tint-border bg-white px-3 py-1.5 text-sm text-red hover:bg-red-tint"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {tables.length === 0 && <p className="text-sm text-muted">No tables yet — add one above.</p>}
      </div>
    </div>
  );
}
