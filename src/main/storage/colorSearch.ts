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
import { cardDirAbs } from './cardFolder';
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16)
  };
}

function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const fx = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE76(lab1: { L: number; a: number; b: number }, lab2: { L: number; a: number; b: number }): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** 100% точность ≈ 5 ΔE; 0% ≈ 80 ΔE. */
export function accuracyToMaxDeltaE(accuracy: number): number {
  const a = Math.max(0, Math.min(100, Math.round(accuracy)));
  return 5 + ((100 - a) / 100) * 75;
}

function scorePalette(queryLab: { L: number; a: number; b: number }, palette: PaletteSwatch[]): number | null {
  if (palette.length === 0) return null;
  let minD = Number.POSITIVE_INFINITY;
  let weighted = 0;
  let weightSum = 0;
  for (const sw of palette) {
    const { r, g, b } = hexToRgb(sw.hex);
    const lab = rgbToLab(r, g, b);
    const d = deltaE76(queryLab, lab);
    minD = Math.min(minD, d);
    const w = sw.pct / 100;
    weighted += d * w;
    weightSum += w;
  }
  if (!Number.isFinite(minD)) return null;
  const avg = weightSum > 0 ? weighted / weightSum : minD;
  return minD * 0.55 + avg * 0.45;
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
    const abs = path.join(cardDirAbs(libraryRoot, row.id), row.original_rel);
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

    const qRgb = hexToRgb(queryHex);
    const queryLab = rgbToLab(qRgb.r, qRgb.g, qRgb.b);
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
      const score = scorePalette(queryLab, palette);
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
