const STORAGE_KEY = 'arc-card-detail-settings-width-v1';

export const CARD_DETAIL_SETTINGS_WIDTH_DEFAULT = 600;
/** Fallback до замера тулбара в `CardDetailOverlay`. */
export const CARD_DETAIL_SETTINGS_WIDTH_MIN = 588;

export function getCardDetailSettingsWidthBounds(measuredMin = CARD_DETAIL_SETTINGS_WIDTH_MIN): {
  min: number;
  max: number;
} {
  const min = Math.max(CARD_DETAIL_SETTINGS_WIDTH_MIN, Math.round(measuredMin));
  const max = Math.max(min, Math.floor(window.innerWidth * 0.5));
  return { min, max };
}

export function clampCardDetailSettingsWidth(
  px: number,
  measuredMin = CARD_DETAIL_SETTINGS_WIDTH_MIN
): number {
  const { min, max } = getCardDetailSettingsWidthBounds(measuredMin);
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
