// Default grid placement for a newly-created table that wasn't given an explicit
// position — spaces tables out so they don't stack at the origin; the admin can
// then drag it to match the real room.
const GRID_COLUMNS = 5;
const GRID_SPACING = 170;
const GRID_ORIGIN = 120;

export function defaultTablePosition(existingCount: number): { x: number; y: number } {
  const col = existingCount % GRID_COLUMNS;
  const row = Math.floor(existingCount / GRID_COLUMNS);
  return { x: GRID_ORIGIN + col * GRID_SPACING, y: GRID_ORIGIN + row * GRID_SPACING };
}
