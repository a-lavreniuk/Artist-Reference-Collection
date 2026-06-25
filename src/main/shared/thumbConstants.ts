/** Размеры превью и выбор тира — общий источник для main и renderer. */

export const THUMB_S_MAX = 384;
export const THUMB_M_MAX = 512;
export const THUMB_L_MAX = 800;

/** Поднимать при смене алгоритма/размеров — триггер фоновой перегенерации thumb_s/thumb_m. */
export const THUMB_GENERATION_VERSION = 3;

export const THUMB_TIER_MAX = {
  s: THUMB_S_MAX,
  m: THUMB_M_MAX,
  l: THUMB_L_MAX
} as const;

export type ThumbTier = keyof typeof THUMB_TIER_MAX;

export function pickThumbTierForRequiredSide(requiredMaxSidePx: number): ThumbTier {
  const need = Math.ceil(Math.max(1, requiredMaxSidePx));
  if (need <= THUMB_S_MAX) return 's';
  if (need <= THUMB_M_MAX) return 'm';
  return 'l';
}

export function thumbTierForGridSize(gridSize: 's' | 'm' | 'l'): ThumbTier {
  if (gridSize === 'l') return 'l';
  if (gridSize === 's') return 's';
  return 'm';
}

export function resolveThumbTier(
  gridSize: 's' | 'm' | 'l',
  requiredMaxSidePx?: number
): ThumbTier {
  if (requiredMaxSidePx != null && Number.isFinite(requiredMaxSidePx) && requiredMaxSidePx > 0) {
    return pickThumbTierForRequiredSide(requiredMaxSidePx);
  }
  return thumbTierForGridSize(gridSize);
}

export function thumbRequiredMaxSidePx(columnWidthCssPx: number, devicePixelRatio = 1): number {
  if (columnWidthCssPx <= 0) return 0;
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.ceil(columnWidthCssPx * dpr);
}
