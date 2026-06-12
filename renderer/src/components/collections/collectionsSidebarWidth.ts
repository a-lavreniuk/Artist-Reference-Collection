const STORAGE_KEY = 'arc-collections-sidebar-width-v1';

export const COLLECTIONS_SIDEBAR_WIDTH_DEFAULT = 400;
export const COLLECTIONS_SIDEBAR_WIDTH_MIN = 320;

export function getCollectionsSidebarWidthBounds(): { min: number; max: number } {
  const min = COLLECTIONS_SIDEBAR_WIDTH_MIN;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampCollectionsSidebarWidth(px: number): number {
  const { min, max } = getCollectionsSidebarWidthBounds();
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function readCollectionsSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return COLLECTIONS_SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return COLLECTIONS_SIDEBAR_WIDTH_DEFAULT;
    return clampCollectionsSidebarWidth(n);
  } catch {
    return COLLECTIONS_SIDEBAR_WIDTH_DEFAULT;
  }
}

export function writeCollectionsSidebarWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampCollectionsSidebarWidth(px)));
  } catch {
    /* private mode */
  }
}
