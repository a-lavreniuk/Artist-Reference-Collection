import { getArcMediaServerOrigin } from '../media/mediaServerHost';
import { getCardByIdFromDb } from '../storage/libraryStorage';
import { readCardJson } from '../storage/cardFolder';
import { getCardDisplayPaletteRows } from '../storage/palette';
import { resolvePathToMediaUrl } from '../toFileUrlHelper';
import { isVideoExt } from '../ffmpeg';

export async function getCardDisplayPalette(
  libraryRoot: string,
  cardId: string
): Promise<Array<{ hex: string; pct: number }>> {
  const row = getCardByIdFromDb(libraryRoot, cardId);
  if (!row) return [];
  return getCardDisplayPaletteRows(libraryRoot, row);
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
