const STORAGE_KEY = 'arc-tags-sidebar-width-v1';

export const TAGS_SIDEBAR_WIDTH_DEFAULT = 400;
export const TAGS_SIDEBAR_WIDTH_MIN = 320;

export function getTagsSidebarWidthBounds(): { min: number; max: number } {
  const min = TAGS_SIDEBAR_WIDTH_MIN;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampTagsSidebarWidth(px: number): number {
  const { min, max } = getTagsSidebarWidthBounds();
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function readTagsSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return TAGS_SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return TAGS_SIDEBAR_WIDTH_DEFAULT;
    return clampTagsSidebarWidth(n);
  } catch {
    return TAGS_SIDEBAR_WIDTH_DEFAULT;
  }
}

export function writeTagsSidebarWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampTagsSidebarWidth(px)));
  } catch {
    /* private mode */
  }
}
