import { useEffect, useRef, useState } from "react";
import type { TableWithSeats } from "../lib/types";
import { hubSize, seatOffsets, tableFootprint } from "../lib/floorPlanGeometry";

interface Position {
  x: number;
  y: number;
}

type SeatType = TableWithSeats["seats"][number];

interface FloorPlanProps {
  tables: TableWithSeats[];
  selectedSeatIds?: Set<string>;
  seatDisabled?: (seat: SeatType) => boolean;
  seatColorClass?: (seat: SeatType, isSelected: boolean) => string;
  onSeatClick?: (seat: SeatType) => void;
  editablePositions?: boolean;
  onTableMove?: (tableId: string, x: number, y: number) => void;
  /** CSS max-height for the scrollable viewport, e.g. "60vh" or "420px". */
  maxHeight?: string;
  /** When set, auto-scrolls the viewport to center on these seats once their position is known. */
  centerSeatIds?: Set<string>;
}

const PADDING = 50;
const MIN_CANVAS_WIDTH = 500;
const MIN_CANVAS_HEIGHT = 400;

function fallbackPosition(index: number): Position {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return { x: 120 + col * 170, y: 120 + row * 170 };
}

export function FloorPlan({
  tables,
  selectedSeatIds,
  seatDisabled,
  seatColorClass,
  onSeatClick,
  editablePositions = false,
  onTableMove,
  maxHeight = "60vh",
  centerSeatIds,
}: FloorPlanProps) {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const draggingId = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const centeredForKey = useRef<string | null>(null);

  useEffect(() => {
    if (draggingId.current) return;
    setPositions(
      Object.fromEntries(
        tables.map((t, i) => [t.id, { x: t.x ?? fallbackPosition(i).x, y: t.y ?? fallbackPosition(i).y }])
      )
    );
  }, [tables]);

  // Auto-scroll to the guest's own seat(s) the first time we know where they
  // are, so they don't have to hunt around the floor plan to find themselves.
  useEffect(() => {
    if (!centerSeatIds || centerSeatIds.size === 0) return;
    const key = Array.from(centerSeatIds).sort().join(",");
    if (centeredForKey.current === key) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const points: Position[] = [];
    for (const t of tables) {
      const pos = positions[t.id];
      if (!pos) continue;
      const offsets = seatOffsets(t.shape, t.seats.length);
      t.seats.forEach((seat, i) => {
        if (centerSeatIds.has(seat.id)) {
          points.push({ x: pos.x + offsetX + offsets[i].dx, y: pos.y + offsetY + offsets[i].dy });
        }
      });
    }
    if (points.length === 0) return;

    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    viewport.scrollTo({
      left: Math.max(0, avgX - viewport.clientWidth / 2),
      top: Math.max(0, avgY - viewport.clientHeight / 2),
      behavior: "smooth",
    });
    centeredForKey.current = key;
  }, [positions, tables, centerSeatIds]);

  // Chairs and tables always render at their natural size. The canvas
  // grows to fit however far tables have been dragged; if that's bigger
  // than the visible area, the viewport scrolls/pans to reach it.
  // Tables can sit close enough to (0,0) that their seats' offsets (which
  // can point up/left of the hub) would land at negative canvas coordinates
  // and get clipped — offsetX/offsetY shift everything so nothing goes
  // negative, without changing the stored/dragged table positions.
  let canvasWidth = MIN_CANVAS_WIDTH;
  let canvasHeight = MIN_CANVAS_HEIGHT;
  let offsetX = 0;
  let offsetY = 0;
  for (const t of tables) {
    const pos = positions[t.id];
    if (!pos) continue;
    const fp = tableFootprint(t.shape, t.seats.length);
    canvasWidth = Math.max(canvasWidth, pos.x + fp.halfWidth + PADDING);
    canvasHeight = Math.max(canvasHeight, pos.y + fp.halfHeight + PADDING);
    offsetX = Math.max(offsetX, PADDING - (pos.x - fp.halfWidth));
    offsetY = Math.max(offsetY, PADDING - (pos.y - fp.halfHeight));
  }
  canvasWidth += offsetX;
  canvasHeight += offsetY;

  function handlePointerDown(e: React.PointerEvent, tableId: string) {
    if (!editablePositions) return;
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPos = positions[tableId] ?? { x: 100, y: 100 };
    draggingId.current = tableId;

    function toNext(ev: PointerEvent): Position {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      return { x: Math.max(40, Math.round(startPos.x + dx)), y: Math.max(40, Math.round(startPos.y + dy)) };
    }

    function onMove(ev: PointerEvent) {
      setPositions((prev) => ({ ...prev, [tableId]: toNext(ev) }));
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const next = toNext(ev);
      draggingId.current = null;
      setPositions((prev) => ({ ...prev, [tableId]: next }));
      onTableMove?.(tableId, next.x, next.y);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <div className="w-full min-w-0 rounded-[18px] border border-hairline bg-card p-2.5 shadow-[0_1px_2px_rgba(31,29,26,0.03)]">
      <div
        ref={viewportRef}
        style={{ maxHeight, overflow: "auto" }}
        className="w-full min-w-0 overscroll-contain rounded-xl"
      >
        <div
          style={{
            position: "relative",
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: "var(--color-paper)",
            backgroundImage: "radial-gradient(var(--color-dot) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            borderRadius: "12px",
          }}
        >
          {tables.map((table) => {
            const pos = positions[table.id];
            if (!pos) return null;
            const offsets = seatOffsets(table.shape, table.seats.length);
            const hub = hubSize(table.shape, table.seats.length);
            return (
              <div
                key={table.id}
                style={{ position: "absolute", left: pos.x + offsetX, top: pos.y + offsetY, width: 0, height: 0 }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => handlePointerDown(e, table.id)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: hub.width,
                    height: hub.height,
                    transform: "translate(-50%, -50%)",
                    touchAction: editablePositions ? "none" : undefined,
                  }}
                  className={`flex items-center justify-center whitespace-nowrap border border-hairline-soft bg-[#f6f4ee] px-1 text-center font-serif text-sm font-semibold text-ink-soft ${
                    table.shape === "round" ? "rounded-full" : "rounded-xl"
                  } ${editablePositions ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                >
                  {table.name}
                </button>
                {table.seats.map((seat, i) => {
                  const { dx, dy } = offsets[i];
                  const isSelected = selectedSeatIds?.has(seat.id);
                  const isMine = seat.isMine;
                  const disabled = seatDisabled ? seatDisabled(seat) : seat.taken && !isSelected;
                  let classes = "seat-btn border ";
                  if (seatColorClass) {
                    classes += seatColorClass(seat, Boolean(isSelected));
                  } else if (isMine || isSelected) {
                    classes += "border-wine-deep bg-wine text-white shadow-[0_0_0_3px_var(--color-wine-tint)]";
                  } else if (seat.taken) {
                    classes += "border-forest bg-forest text-forest-ink";
                  } else {
                    classes += "border-line-soft bg-white text-muted-soft";
                  }
                  if (!disabled) classes += " active:scale-95";
                  else classes += " cursor-not-allowed";
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onSeatClick?.(seat)}
                      style={{ position: "absolute", left: dx, top: dy, transform: "translate(-50%, -50%)" }}
                      className={classes}
                      title={seat.guestName ? `${seat.label} — ${seat.guestName}` : seat.label}
                    >
                      {seat.label.split("-").pop()}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
