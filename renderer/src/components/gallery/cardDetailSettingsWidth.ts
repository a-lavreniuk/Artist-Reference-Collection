const STORAGE_KEY = 'arc-card-detail-settings-width-v1';

export const CARD_DETAIL_SETTINGS_WIDTH_DEFAULT = 600;
/** Минимум для вмещения `.arc-card-detail-options` (см. `--arc-card-detail-settings-min-w` в index.css). */
export const CARD_DETAIL_SETTINGS_WIDTH_MIN = 588;

export function getCardDetailSettingsWidthBounds(): { min: number; max: number } {
  const min = CARD_DETAIL_SETTINGS_WIDTH_MIN;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampCardDetailSettingsWidth(px: number): number {
  const { min, max } = getCardDetailSettingsWidthBounds();
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function readCardDetailSettingsWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
    return clampCardDetailSettingsWidth(n);
  } catch {
    return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
  }
}

export function writeCardDetailSettingsWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampCardDetailSettingsWidth(px)));
  } catch {
    /* private mode */
  }
}
