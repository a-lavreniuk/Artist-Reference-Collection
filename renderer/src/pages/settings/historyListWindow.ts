/** Skip windowing for short journals — spacers are unnecessary. */
export const HISTORY_VIRTUALIZE_AFTER = 40;
export const HISTORY_OVERSCAN = 12;
/** Item + separator estimate; refined by measuring the first visible row. */
export const HISTORY_ROW_ESTIMATE_PX = 56;

export function historyVisibleRange(
  length: number,
  scrollTop: number,
  clientHeight: number,
  rowHeight: number,
  overscan: number
): { start: number; end: number } {
  if (length <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(length, Math.ceil((scrollTop + clientHeight) / rowHeight) + overscan);
  return { start, end };
}
