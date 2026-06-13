const STORAGE_KEY = 'arc-settings-sidebar-width-v1';

export const SETTINGS_SIDEBAR_WIDTH_DEFAULT = 400;
export const SETTINGS_SIDEBAR_WIDTH_MIN = 320;

export function getSettingsSidebarWidthBounds(): { min: number; max: number } {
  const min = SETTINGS_SIDEBAR_WIDTH_MIN;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampSettingsSidebarWidth(px: number): number {
  const { min, max } = getSettingsSidebarWidthBounds();
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function readSettingsSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SETTINGS_SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return SETTINGS_SIDEBAR_WIDTH_DEFAULT;
    return clampSettingsSidebarWidth(n);
  } catch {
    return SETTINGS_SIDEBAR_WIDTH_DEFAULT;
  }
}

export function writeSettingsSidebarWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampSettingsSidebarWidth(px)));
  } catch {
    /* private mode */
  }
}
