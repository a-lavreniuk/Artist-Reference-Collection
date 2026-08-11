import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import {
  buildPaletteFromRaw,
  normalizeHex,
  paletteHasColorfulAccent,
  selectPaletteForDisplay,
  type PaletteMode,
  type PaletteSwatch
} from '../shared/paletteCore';
import type { CardIndexRow } from './types';

export type { PaletteSwatch, PaletteMode } from '../shared/paletteCore';
export {
  normalizeHex,
  paletteHasColorfulAccent,
  selectPaletteForDisplay,
  selectPaletteTopN
} from '../shared/paletteCore';

const PALETTE_SIZE_SEARCH = 128;

/** Сколько свотчей показывать в деталке карточки — всегда фиксированный лимит. */
export const CARD_DETAIL_PALETTE_MAX = 12;

/** Diversity greedy: ровно до max свотчей (12), без укорочения от красочности. */
export function trimPaletteForDisplay(swatches: PaletteSwatch[], max = CARD_DETAIL_PALETTE_MAX): PaletteSwatch[] {
  return selectPaletteForDisplay(swatches, max);
}

/**
 * Файл для пересчёта палитры: image → original; video → thumb (sharp не читает video).
 */
export function resolvePaletteSourceAbs(libraryRoot: string, row: CardIndexRow): string | null {
  const joinRel = (rel: string | undefined | null) => {
    if (!rel) return null;
    const abs = path.join(libraryRoot, rel.replace(/\//g, path.sep));
    return fs.existsSync(abs) ? abs : null;
  };

  if (row.type === 'video') {
    return joinRel(row.thumbLRel) || joinRel(row.thumbMRel) || joinRel(row.thumbSRel);
  }
  return joinRel(row.originalRel) || joinRel(row.thumbLRel) || joinRel(row.thumbMRel) || joinRel(row.thumbSRel);
}

/** Display-палитра карточки (image | video): всегда целимся в 12 уникальных плашек. */
export async function getCardDisplayPaletteRows(
  libraryRoot: string,
  row: CardIndexRow
): Promise<PaletteSwatch[]> {
  if (row.type !== 'image' && row.type !== 'video') return [];

  const stored = parsePaletteJson(row.paletteJson);
  const abs = resolvePaletteSourceAbs(libraryRoot, row);
  const storedUnique = trimPaletteForDisplay(stored, CARD_DETAIL_PALETTE_MAX);

  // Короткой сохранённой палитры недостаточно — пересчитать с файла.
  const storedEnough = storedUnique.length >= CARD_DETAIL_PALETTE_MAX;

  if (storedEnough) {
    return storedUnique;
  }

  if (abs) {
    try {
      const full = await computeImagePalette(abs, 'search');
      const display = trimPaletteForDisplay(full, CARD_DETAIL_PALETTE_MAX);
      if (display.length > 0) {
        const shouldPersist =
          full.length > stored.length ||
          display.length > storedUnique.length ||
          (paletteHasColorfulAccent(display) && !paletteHasColorfulAccent(storedUnique));
        if (shouldPersist) {
          try {
            const { isMaintenanceLocked } = await import('../maintenanceLock');
            if (!isMaintenanceLocked()) {
              const { openLibraryDb } = await import('./db');
              openLibraryDb(libraryRoot)
                .prepare('UPDATE cards SET palette_json = ? WHERE id = ?')
                .run(JSON.stringify(full), row.id);
            }
          } catch {
            /* best-effort persist */
          }
        }
        return display;
      }
    } catch {
      /* fall through */
    }
  }

  if (storedUnique.length > 0) return storedUnique;
  return parsePaletteJson(null, row.dominantColor);
}

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
