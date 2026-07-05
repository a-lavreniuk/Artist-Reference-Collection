import sharp from 'sharp';

import {
  buildPaletteFromRaw,
  normalizeHex,
  type PaletteMode,
  type PaletteSwatch
} from '../shared/paletteCore';

export type { PaletteSwatch, PaletteMode } from '../shared/paletteCore';
export { normalizeHex } from '../shared/paletteCore';

const PALETTE_SIZE_SEARCH = 128;

/** Палитра для поиска по цвету (mode search: до 20 свотчей, 128×128). */
export async function computeImagePalette(
  sourceAbs: string,
  mode: PaletteMode = 'search'
): Promise<PaletteSwatch[]> {
  const sampleSize = mode === 'search' ? PALETTE_SIZE_SEARCH : 72;
  const { data, info } = await sharp(sourceAbs)
    .rotate()
    .resize(sampleSize, sampleSize, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return buildPaletteFromRaw(data, info.width, info.height, info.channels, mode);
}

export function parsePaletteJson(raw: string | null | undefined, fallbackDominant?: string): PaletteSwatch[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const swatches = parsed
          .filter(
            (x): x is { hex: string; pct: number } =>
              Boolean(x) &&
              typeof x === 'object' &&
              typeof (x as { hex?: string }).hex === 'string' &&
              typeof (x as { pct?: number }).pct === 'number'
          )
          .map((x) => ({ hex: normalizeHex(x.hex), pct: Math.max(0, x.pct) }))
          .filter((x) => x.hex);
        if (swatches.length > 0) return swatches;
      }
    } catch {
      /* fallback below */
    }
  }
  const dom = fallbackDominant ? normalizeHex(fallbackDominant) : '';
  return dom ? [{ hex: dom, pct: 100 }] : [];
}
