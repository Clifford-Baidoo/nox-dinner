export const TABLE_SHAPES = ["round", "square", "rectangle"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

export function isTableShape(value: unknown): value is TableShape {
  return TABLE_SHAPES.includes(value as TableShape);
}
