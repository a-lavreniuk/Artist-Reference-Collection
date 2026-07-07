import path from 'path';
import {
  buildGalleryFilterWhere,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  type GalleryAdvancedFilters,
  type GallerySortState
} from './galleryFilters';
import { getGalleryFilterBoundaries } from './galleryFilterBoundariesCache';
import { shuffleCardIds } from '../shared/shuffleCardIds';
import { scorePaletteMinDeltaE } from '../shared/paletteCore';
import { openLibraryDb } from './db';
import { indexCardRowsFromDb } from './libraryStorage';
import { getOrBuildScoredSearchPage, stableSearchCacheKey } from './scoredSearchCache';
import { computeImagePalette, normalizeHex, parsePaletteJson, type PaletteSwatch } from './palette';
import type { CardIndexRow, LibraryScope } from './types';

export type ColorSearchParams = {
  hex: string;
  /** 0–100: выше — строже совпадение. */
  accuracy: number;
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters?: GalleryAdvancedFilters;
  sort?: GallerySortState;
  scopeCardIds?: ReadonlySet<string> | null;
  offset?: number;
  limit?: number;
};

/** 100% точность ≈ 5 ΔE; 0% ≈ 80 ΔE. */
export function accuracyToMaxDeltaE(accuracy: number): number {
  const a = Math.max(0, Math.min(100, Math.round(accuracy)));
  return 5 + ((100 - a) / 100) * 75;
}

function scorePalette(queryHex: string, palette: PaletteSwatch[]): number | null {
  return scorePaletteMinDeltaE(queryHex, palette);
}

export async function backfillPalettesBatch(libraryRoot: string, limit = 48): Promise<number> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT id, original_rel, dominant_color FROM cards
       WHERE type = 'image' AND COALESCE(is_deleted, 0) = 0
         AND (palette_json IS NULL OR palette_json = '')
       LIMIT ?`
    )
    .all(limit) as Array<{ id: string; original_rel: string; dominant_color: string | null }>;

  const upd = db.prepare('UPDATE cards SET palette_json = ? WHERE id = ?');
  let done = 0;
  for (const row of rows) {
    const abs = path.join(libraryRoot, row.original_rel.replace(/\//g, path.sep));
    try {
      const palette = await computeImagePalette(abs);
      if (palette.length === 0 && row.dominant_color) {
        upd.run(JSON.stringify(parsePaletteJson(null, row.dominant_color)), row.id);
      } else {
        upd.run(JSON.stringify(palette), row.id);
      }
      done += 1;
    } catch {
      if (row.dominant_color) {
        upd.run(JSON.stringify(parsePaletteJson(null, row.dominant_color)), row.id);
        done += 1;
      }
    }
  }
  return done;
}

export function searchCardsByColor(libraryRoot: string, params: ColorSearchParams): CardIndexRow[] {
  const queryHex = normalizeHex(params.hex);
  if (!queryHex) return [];

  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.max(1, params.limit ?? 50);
  const sort = params.sort ?? DEFAULT_GALLERY_SORT;
  const filters = params.advancedFilters ?? emptyGalleryAdvancedFilters();
  const cacheKey = stableSearchCacheKey({
    kind: 'color',
    hex: queryHex,
    accuracy: params.accuracy,
    libraryScope: params.libraryScope,
    selectedTagIds: params.selectedTagIds,
    cardIdExact: params.cardIdExact,
    collectionId: params.collectionId,
    moodboardCardIds: params.moodboardCardIds,
    filters,
    sort,
    scopeCardIds: params.scopeCardIds ? [...params.scopeCardIds].sort() : null
  });

  return getOrBuildScoredSearchPage(cacheKey, offset, limit, () => {
    const db = openLibraryDb(libraryRoot);
    const boundaries = getGalleryFilterBoundaries(db, filters);
    const { wh, binds } = buildGalleryFilterWhere(
      {
        libraryScope: params.libraryScope,
        selectedTagIds: params.selectedTagIds,
        cardIdExact: params.cardIdExact,
        collectionId: params.collectionId,
        moodboardCardIds: params.moodboardCardIds,
        filters,
        sort
      },
      'c',
      boundaries
    );

    wh.push("c.type = 'image'");
    const sql = `SELECT c.* FROM cards c WHERE ${wh.join(' AND ')}`;
    const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];

    const maxDeltaE = accuracyToMaxDeltaE(params.accuracy);
    const scope = params.scopeCardIds;

    const scored: Array<{ row: Record<string, unknown>; score: number }> = [];
    for (const row of rows) {
      const id = String(row.id);
      if (scope && scope.size > 0 && !scope.has(id)) continue;
      const palette = parsePaletteJson(
        row.palette_json ? String(row.palette_json) : null,
        row.dominant_color ? String(row.dominant_color) : undefined
      );
      const score = scorePalette(queryHex, palette);
      if (score == null || score > maxDeltaE) continue;
      scored.push({ row, score });
    }

    scored.sort((a, b) => a.score - b.score);

    let orderedRows: Record<string, unknown>[];
    if (sort.field === 'shuffle') {
      const shuffledIds = shuffleCardIds(
        scored.map((s) => String(s.row.id)),
        sort.shuffleSeed ?? 0
      );
      const byId = new Map(scored.map((s) => [String(s.row.id), s.row]));
      orderedRows = shuffledIds.map((id) => byId.get(id)).filter((r): r is Record<string, unknown> => Boolean(r));
    } else {
      const sorted = [...scored];
      if (sort.field === 'addedAt') {
        const dir = sort.direction === 'asc' ? 1 : -1;
        sorted.sort((a, b) => String(a.row.added_at ?? '').localeCompare(String(b.row.added_at ?? '')) * dir);
      } else if (sort.field === 'fileWeight') {
        const dir = sort.direction === 'asc' ? 1 : -1;
        sorted.sort((a, b) => ((Number(a.row.file_size) || 0) - (Number(b.row.file_size) || 0)) * dir);
      }
      orderedRows = sorted.map((s) => s.row);
    }

    return indexCardRowsFromDb(db, orderedRows);
  });
}
