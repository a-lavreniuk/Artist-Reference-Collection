const CARD_WIDTH_PX = 389;
const CARD_GAP_FALLBACK_PX = 32;
const OVERSCAN = 2;

export function collectionsStripVisibleRange(
  scrollLeft: number,
  viewportWidth: number,
  count: number,
  stridePx: number
): { start: number; end: number } {
  if (count <= 0 || stridePx <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollLeft / stridePx) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollLeft + viewportWidth) / stridePx) + OVERSCAN);
  return { start, end };
}

export function collectionsStripMetrics(count: number, cardWidth = CARD_WIDTH_PX, gap = CARD_GAP_FALLBACK_PX) {
  const stride = cardWidth + gap;
  const totalWidth = count <= 0 ? 0 : count * cardWidth + Math.max(0, count - 1) * gap;
  return { cardWidth, gap, stride, totalWidth };
}

export { CARD_WIDTH_PX, CARD_GAP_FALLBACK_PX };
