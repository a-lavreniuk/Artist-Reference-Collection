import path from 'path';

import { getArcMediaServerOrigin } from '../media/mediaServerHost';
import { getCardByIdFromDb } from '../storage/libraryStorage';
import { readCardJson } from '../storage/cardFolder';
import {
  CARD_DETAIL_PALETTE_MAX,
  computeImagePalette,
  parsePaletteJson,
  trimPaletteForDisplay
} from '../storage/palette';
import { resolvePathToMediaUrl } from '../toFileUrlHelper';
import { isVideoExt } from '../ffmpeg';

export async function getCardDisplayPalette(
  libraryRoot: string,
  cardId: string
): Promise<Array<{ hex: string; pct: number }>> {
  const row = getCardByIdFromDb(libraryRoot, cardId);
  if (!row || row.type !== 'image' || !row.originalRel) return [];

  const stored = parsePaletteJson(row.paletteJson);
  if (stored.length > 0) {
    return trimPaletteForDisplay(stored, CARD_DETAIL_PALETTE_MAX);
  }

  const abs = path.join(libraryRoot, row.originalRel.replace(/\//g, path.sep));
  try {
    const palette = await computeImagePalette(abs, 'search');
    const computed = trimPaletteForDisplay(palette, CARD_DETAIL_PALETTE_MAX);
    if (computed.length > 0) return computed;
  } catch {
    /* fallback */
  }

  return parsePaletteJson(null, row.dominantColor);
}

export async function resolveCardMediaUrl(
  libraryRoot: string,
  cardId: string,
  variant: 'thumb' | 'original'
): Promise<string | null> {
  const row = getCardByIdFromDb(libraryRoot, cardId);
  if (!row) return null;
  const rel =
    variant === 'thumb'
      ? row.thumbMRel || row.thumbSRel || row.thumbLRel || row.originalRel
      : row.originalRel;
  if (!rel) return null;
  const origin = getArcMediaServerOrigin();
  return resolvePathToMediaUrl(rel, libraryRoot, isVideoExt, origin);
}

export async function getCardMediaRel(
  libraryRoot: string,
  cardId: string,
  variant: 'thumb' | 'original'
): Promise<string | null> {
  const row = getCardByIdFromDb(libraryRoot, cardId);
  if (!row) return null;
  if (variant === 'thumb') {
    return row.thumbMRel || row.thumbSRel || row.thumbLRel || row.originalRel || null;
  }
  return row.originalRel || null;
}

export async function readCardExtraFields(
  libraryRoot: string,
  cardId: string
): Promise<{ fileCreatedAt?: string }> {
  const cardJson = await readCardJson(libraryRoot, cardId);
  if (!cardJson?.fileCreatedAt) return {};
  return { fileCreatedAt: cardJson.fileCreatedAt };
}
