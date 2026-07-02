import { mkdir, rm, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { app } from 'electron';
import { readAppPreferences } from '../appPreferences';
import { ensureLightClipForHybrid } from './aiEmbeddingService';
import { embedImageInWorker, initAiWorker, getModelsDir } from './aiWorkerBridge';
import { vectorFromNumbers } from './semanticSearch';
import { searchByVisualEmbedding } from './visualSearch';
import type { ModelTier } from './types';
import {
  buildGalleryFilterWhere,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  type GalleryAdvancedFilters,
  type GallerySortState
} from '../storage/galleryFilters';
import { getGalleryFilterBoundaries } from '../storage/galleryFilterBoundariesCache';
import { getOrBuildScoredSearchPageAsync, stableSearchCacheKey } from '../storage/scoredSearchCache';
import { shuffleCardIds } from '../shared/shuffleCardIds';
import { openLibraryDb } from '../storage/db';
import { indexCardRowsFromDb } from '../storage/libraryStorage';
import type { CardIndexRow, LibraryScope } from '../storage/types';

export type NormalizedCropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SimilarImageSearchParams = {
  cardId?: string | null;
  imagePath?: string | null;
  crop?: NormalizedCropRect | null;
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters?: GalleryAdvancedFilters;
  sort?: GallerySortState;
  scopeCardIds?: ReadonlySet<string> | null;
  tier: ModelTier;
  modelId: string;
  strictness: number;
  offset?: number;
  limit?: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeCrop(crop?: NormalizedCropRect | null): NormalizedCropRect {
  if (!crop) return { x: 0, y: 0, w: 1, h: 1 };
  const w = clamp01(crop.w);
  const h = clamp01(crop.h);
  const x = clamp01(crop.x);
  const y = clamp01(crop.y);
  if (w <= 0.01 || h <= 0.01) return { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: Math.min(x, 1 - w),
    y: Math.min(y, 1 - h),
    w,
    h
  };
}

export function similarQueryDir(): string {
  return path.join(app.getPath('userData'), 'similar-query');
}

const ALLOWED_STAGE_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export async function stageSimilarQueryFile(sourceAbsPath: string): Promise<string> {
  const resolved = path.resolve(sourceAbsPath.trim());
  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    throw new Error('Файл не найден.');
  }
  if (!fileStat.isFile()) {
    throw new Error('Указанный путь не является файлом.');
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_STAGE_IMAGE_EXT.has(ext)) {
    throw new Error('Неподдерживаемый формат изображения.');
  }
  const dir = similarQueryDir();
  await mkdir(dir, { recursive: true });
  const destExt = ext || '.jpg';
  const dest = path.join(dir, `query-${Date.now()}${destExt}`);
  const input = sharp(resolved);
  const meta = await input.metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Не удалось прочитать изображение.');
  }
  await input.toFile(dest);
  return dest;
}

export async function clearSimilarQueryDir(): Promise<void> {
  try {
    await rm(similarQueryDir(), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function resolveSourceImagePath(libraryRoot: string, params: SimilarImageSearchParams): string | null {
  if (params.imagePath && params.imagePath.trim()) {
    return params.imagePath.trim();
  }
  const cardId = params.cardId?.trim();
  if (!cardId) return null;
  const db = openLibraryDb(libraryRoot);
  const row = db.prepare('SELECT original_rel, type FROM cards WHERE id = ?').get(cardId) as
    | { original_rel?: string; type?: string }
    | undefined;
  if (!row?.original_rel || row.type !== 'image') return null;
  return path.join(libraryRoot, row.original_rel);
}

async function writeCroppedTemp(sourceAbs: string, crop: NormalizedCropRect): Promise<string> {
  const dir = similarQueryDir();
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `crop-${Date.now()}.jpg`);
  const meta = await sharp(sourceAbs).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 2 || height < 2) {
    await sharp(sourceAbs).jpeg({ quality: 92 }).toFile(out);
    return out;
  }
  const rect = normalizeCrop(crop);
  const left = Math.round(rect.x * width);
  const top = Math.round(rect.y * height);
  const w = Math.max(1, Math.round(rect.w * width));
  const h = Math.max(1, Math.round(rect.h * height));
  await sharp(sourceAbs)
    .extract({ left, top, width: Math.min(w, width - left), height: Math.min(h, height - top) })
    .jpeg({ quality: 92 })
    .toFile(out);
  return out;
}

export async function searchCardsBySimilarImage(
  libraryRoot: string,
  params: SimilarImageSearchParams
): Promise<CardIndexRow[]> {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.max(1, params.limit ?? 50);
  const cacheKey = stableSearchCacheKey({
    kind: 'similar',
    cardId: params.cardId ?? null,
    imagePath: params.imagePath ?? null,
    crop: params.crop ?? null,
    libraryScope: params.libraryScope,
    selectedTagIds: params.selectedTagIds,
    cardIdExact: params.cardIdExact,
    collectionId: params.collectionId,
    moodboardCardIds: params.moodboardCardIds,
    filters: params.advancedFilters ?? emptyGalleryAdvancedFilters(),
    sort: params.sort ?? DEFAULT_GALLERY_SORT,
    scopeCardIds: params.scopeCardIds ? [...params.scopeCardIds].sort() : null,
    tier: params.tier,
    modelId: params.modelId,
    strictness: params.strictness
  });
  return getOrBuildScoredSearchPageAsync(cacheKey, offset, limit, () =>
    searchCardsBySimilarImageAll(libraryRoot, params)
  );
}

async function searchCardsBySimilarImageAll(
  libraryRoot: string,
  params: SimilarImageSearchParams
): Promise<CardIndexRow[]> {
  const sourceAbs = resolveSourceImagePath(libraryRoot, params);
  if (!sourceAbs) return [];

  const crop = normalizeCrop(params.crop);
  const croppedPath = await writeCroppedTemp(sourceAbs, crop);
  try {
    const modelsDir = getModelsDir();
    const prefs = await readAppPreferences();
    const lightId = await ensureLightClipForHybrid();
    await initAiWorker('light', modelsDir, {
      threads: prefs.aiThreads,
      gpuLayers: prefs.aiGpuLayers,
      maxRamMb: prefs.aiMaxRamMb
    });
    const vector = await embedImageInWorker(croppedPath, lightId);
    const searchTier = params.tier;
    const searchModelId = searchTier === 'heavy' ? params.modelId : lightId;
    const hits = searchByVisualEmbedding(vectorFromNumbers(vector), searchModelId, {
      tier: params.tier,
      strictness: params.strictness,
      useCache: false
    });
    if (hits.length === 0) return [];

    const db = openLibraryDb(libraryRoot);
    const sort = params.sort ?? DEFAULT_GALLERY_SORT;
    const filters = params.advancedFilters ?? emptyGalleryAdvancedFilters();
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

    const scope = params.scopeCardIds;
    const queryCardId = params.cardId?.trim() ?? null;
    const hitIds = hits.map((h) => h.cardId);
    const placeholders = hitIds.map(() => '?').join(',');
    wh.push(`c.id IN (${placeholders})`);
    binds.push(...hitIds);
    wh.push("c.type = 'image'");

    const sql = `SELECT c.* FROM cards c WHERE ${wh.join(' AND ')}`;
    const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];

    const scoreById = new Map(hits.map((h) => [h.cardId, h.score]));
    const scored = rows
      .map((row) => {
        const id = String(row.id);
        if (scope && scope.size > 0 && !scope.has(id)) return null;
        if (queryCardId && id === queryCardId) return null;
        const score = scoreById.get(id);
        if (score == null) return null;
        return { row, score };
      })
      .filter((x): x is { row: Record<string, unknown>; score: number } => Boolean(x));

    scored.sort((a, b) => b.score - a.score);

    if (sort.field === 'shuffle') {
      const shuffledIds = shuffleCardIds(
        scored.map((s) => String(s.row.id)),
        sort.shuffleSeed ?? 0
      );
      const byId = new Map(scored.map((s) => [String(s.row.id), s.row]));
      const ordered = shuffledIds.map((id) => byId.get(id)).filter((r): r is Record<string, unknown> => Boolean(r));
      return indexCardRowsFromDb(db, ordered);
    }

    if (sort.field === 'addedAt') {
      const dir = sort.direction === 'asc' ? 1 : -1;
      scored.sort((a, b) => String(a.row.added_at ?? '').localeCompare(String(b.row.added_at ?? '')) * dir);
    } else if (sort.field === 'fileWeight') {
      const dir = sort.direction === 'asc' ? 1 : -1;
      scored.sort(
        (a, b) => ((Number(a.row.file_size) || 0) - (Number(b.row.file_size) || 0)) * dir
      );
    }

    return indexCardRowsFromDb(
      db,
      scored.map((s) => s.row)
    );
  } finally {
    try {
      await rm(croppedPath, { force: true });
    } catch {
      /* ignore */
    }
  }
}
