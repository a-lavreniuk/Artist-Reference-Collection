/** Альбомные ячейки Grid (Eagle-like): ширина / высота = 4/3. */
export const UNIFORM_GRID_ASPECT_RATIO = 4 / 3;

export function uniformGridCellHeight(columnWidth: number): number {
  if (columnWidth <= 0) return 0;
  return columnWidth / UNIFORM_GRID_ASPECT_RATIO;
}
