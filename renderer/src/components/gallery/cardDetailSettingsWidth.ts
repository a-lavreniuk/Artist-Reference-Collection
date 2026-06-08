const STORAGE_KEY = 'arc-card-detail-settings-width-v1';

export const CARD_DETAIL_SETTINGS_WIDTH_DEFAULT = 600;
export const CARD_DETAIL_SETTINGS_WIDTH_MIN = 500;
export const CARD_DETAIL_SETTINGS_WIDTH_MAX = 720;

export function readCardDetailSettingsWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
    return Math.min(CARD_DETAIL_SETTINGS_WIDTH_MAX, Math.max(CARD_DETAIL_SETTINGS_WIDTH_MIN, n));
  } catch {
    return CARD_DETAIL_SETTINGS_WIDTH_DEFAULT;
  }
}

export function writeCardDetailSettingsWidth(px: number): void {
  try {
    const clamped = Math.min(
      CARD_DETAIL_SETTINGS_WIDTH_MAX,
      Math.max(CARD_DETAIL_SETTINGS_WIDTH_MIN, Math.round(px))
    );
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* private mode */
  }
}
