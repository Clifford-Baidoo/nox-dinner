import type { TableShape } from "./types";

export const SEAT_SIZE = 42;
const ROUND_HUB_DIAMETER = 60;
const ROUND_SEAT_ORBIT = 66;
const PERIMETER_SEAT_GAP = 46;
const PERIMETER_SEAT_MARGIN = SEAT_SIZE / 2 + 10;
const RECT_ASPECT: Record<"square" | "rectangle", number> = { square: 1, rectangle: 2.2 };
const MIN_SIDE = 50;

export interface Offset {
  dx: number;
  dy: number;
}

function rectDimensions(shape: "square" | "rectangle", seatCount: number): { width: number; height: number } {
  const aspect = RECT_ASPECT[shape];
  const perimeter = Math.max(seatCount, 4) * PERIMETER_SEAT_GAP;
  const height = Math.max(MIN_SIDE, perimeter / (2 * (aspect + 1)));
  const width = Math.max(MIN_SIDE, aspect * height);
  return { width, height };
}

export function seatOffsets(shape: TableShape, seatCount: number): Offset[] {
  if (shape === "round") {
    return Array.from({ length: seatCount }, (_, i) => {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / seatCount);
      return { dx: Math.cos(angle) * ROUND_SEAT_ORBIT, dy: Math.sin(angle) * ROUND_SEAT_ORBIT };
    });
  }

  // Walk seats evenly around the rectangle's perimeter, offset outward from
  // each edge. Each seat is placed at the *midpoint* of its slice of the
  // perimeter (the "+ 0.5") rather than at the start — otherwise seats land
  // exactly on the corners instead of being centered along each side.
  const { width, height } = rectDimensions(shape, seatCount);
  const halfW = width / 2;
  const halfH = height / 2;
  const perimeter = 2 * (width + height);

  return Array.from({ length: seatCount }, (_, i) => {
    const d = ((i + 0.5) / seatCount) * perimeter;
    if (d < width) return { dx: -halfW + d, dy: -halfH - PERIMETER_SEAT_MARGIN };
    if (d < width + height) return { dx: halfW + PERIMETER_SEAT_MARGIN, dy: -halfH + (d - width) };
    if (d < 2 * width + height) return { dx: halfW - (d - width - height), dy: halfH + PERIMETER_SEAT_MARGIN };
    return { dx: -halfW - PERIMETER_SEAT_MARGIN, dy: halfH - (d - 2 * width - height) };
  });
}

export function hubSize(shape: TableShape, seatCount: number): { width: number; height: number } {
  if (shape === "round") return { width: ROUND_HUB_DIAMETER, height: ROUND_HUB_DIAMETER };
  return rectDimensions(shape, seatCount);
}

export function tableFootprint(shape: TableShape, seatCount: number): { halfWidth: number; halfHeight: number } {
  if (shape === "round") {
    const half = ROUND_SEAT_ORBIT + SEAT_SIZE / 2 + 8;
    return { halfWidth: half, halfHeight: half };
  }
  const { width, height } = rectDimensions(shape, seatCount);
  return {
    halfWidth: width / 2 + PERIMETER_SEAT_MARGIN + SEAT_SIZE / 2 + 8,
    halfHeight: height / 2 + PERIMETER_SEAT_MARGIN + SEAT_SIZE / 2 + 8,
  };
}
