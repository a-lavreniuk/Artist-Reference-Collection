const STORAGE_KEY = 'arc-duplicates-sidebar-width-v1';

export const DUPLICATES_SIDEBAR_WIDTH_DEFAULT = 400;
/** Ниже этого «Похожесть 100%» в плашке пары обрезается (превью 56px × 2 + отступы). */
export const DUPLICATES_SIDEBAR_WIDTH_MIN = 400;

export function getDuplicatesSidebarWidthBounds(): { min: number; max: number } {
  const min = DUPLICATES_SIDEBAR_WIDTH_MIN;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampDuplicatesSidebarWidth(px: number): number {
  const { min, max } = getDuplicatesSidebarWidthBounds();
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function readDuplicatesSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DUPLICATES_SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return DUPLICATES_SIDEBAR_WIDTH_DEFAULT;
    return clampDuplicatesSidebarWidth(n);
  } catch {
    return DUPLICATES_SIDEBAR_WIDTH_DEFAULT;
  }
}

export function writeDuplicatesSidebarWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampDuplicatesSidebarWidth(px)));
  } catch {
    /* private mode */
  }
}
