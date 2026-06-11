import type Database from 'better-sqlite3';
import { openLibraryDb } from './db';
import {
  aspectRatioSql,
  buildGalleryFilterWhere,
  computeFileWeightBuckets,
  dateRangeForPreset,
  emptyGalleryAdvancedFilters,
  getMaxDurationMs,
  getMaxFileSizeBytes,
  hasAnyVideo,
  type AspectRatioFilterValue,
  type GalleryFilterQueryContext,
  type GallerySortState
} from './galleryFilters';
import type { LibraryScope } from './types';

export type GalleryFilterStats = {
  weightBuckets: ReturnType<typeof computeFileWeightBuckets>;
  maxDurationMs: number;
  hasVideo: boolean;
  aspectRatio: Record<AspectRatioFilterValue, number>;
  fileExtensions: Record<string, number>;
  description: { has: number; missing: number };
  link: { has: number; missing: number };
  dateAdded: Record<string, number>;
  fileWeight: Record<string, number>;
  resolution: Record<string, number>;
  duration: Record<string, number>;
};

function baseContext(
  libraryScope: LibraryScope,
  selectedTagIds: string[],
  cardIdExact: string | null,
  collectionId: string | null,
  moodboardCardIds: string[] | null
): GalleryFilterQueryContext {
  return {
    libraryScope,
    selectedTagIds,
    cardIdExact,
    collectionId,
    moodboardCardIds,
    filters: emptyGalleryAdvancedFilters(),
    sort: { field: 'addedAt', direction: 'desc' } satisfies GallerySortState
  };
}

function countWithExtra(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  extraWh: string[],
  extraBinds: unknown[] = [],
  weightBuckets?: ReturnType<typeof computeFileWeightBuckets>
): number {
  const { wh, binds } = buildGalleryFilterWhere(ctx, 'c', weightBuckets);
  const allWh = [...wh, ...extraWh];
  const sql = `SELECT COUNT(*) AS n FROM cards c${allWh.length ? ` WHERE ${allWh.join(' AND ')}` : ''}`;
  const row = db.prepare(sql).get(...binds, ...extraBinds) as { n: number };
  return row.n ?? 0;
}

export function getGalleryFilterStats(
  libraryRoot: string,
  opts: {
    libraryScope?: LibraryScope;
    selectedTagIds?: string[];
    cardIdExact?: string | null;
    collectionId?: string | null;
    moodboardCardIds?: string[] | null;
  }
): GalleryFilterStats {
  const db = openLibraryDb(libraryRoot);
  const ctx = baseContext(
    opts.libraryScope ?? 'all',
    opts.selectedTagIds ?? [],
    opts.cardIdExact ?? null,
    opts.collectionId ?? null,
    opts.moodboardCardIds ?? null
  );
  const maxBytes = getMaxFileSizeBytes(db);
  const weightBuckets = computeFileWeightBuckets(maxBytes);
  const maxDurationMs = getMaxDurationMs(db);
  const hasVideo = hasAnyVideo(db);

  const aspectMap = aspectRatioSql('c');
  const aspectRatio = {} as Record<AspectRatioFilterValue, number>;
  for (const key of Object.keys(aspectMap) as AspectRatioFilterValue[]) {
    aspectRatio[key] = countWithExtra(db, ctx, [`(${aspectMap[key]})`], [], weightBuckets);
  }

  const extRows = db
    .prepare(
      `SELECT DISTINCT LOWER(COALESCE(format, '')) AS fmt FROM cards c WHERE COALESCE(c.is_deleted, 0) = 0 AND COALESCE(format, '') != ''`
    )
    .all() as Array<{ fmt: string }>;
  const fileExtensions: Record<string, number> = {};
  for (const r of extRows) {
    if (!r.fmt) continue;
    fileExtensions[r.fmt.toUpperCase()] = countWithExtra(
      db,
      ctx,
      [`LOWER(COALESCE(c.format, '')) = ?`],
      [r.fmt],
      weightBuckets
    );
  }

  const description = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.description,'') != '')`], [], weightBuckets),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.description,'') = '')`], [], weightBuckets)
  };
  const link = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.link_url,'') != '')`], [], weightBuckets),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.link_url,'') = '')`], [], weightBuckets)
  };

  const dateKeys = ['today', 'yesterday', 'week', 'month', 'threeMonths', 'year'] as const;
  const dateAdded: Record<string, number> = {};
  for (const preset of dateKeys) {
    const { from, to } = dateRangeForPreset(preset);
    dateAdded[preset] = countWithExtra(
      db,
      ctx,
      ['(c.added_at >= ? AND c.added_at <= ?)'],
      [from.toISOString(), to.toISOString()],
      weightBuckets
    );
  }

  const mb = (col: string) => `(${col} * 1.0 / (1024 * 1024))`;
  const sizeMb = mb('COALESCE(c.file_size, 0)');
  const { b1, b2, b3 } = weightBuckets;
  const fileWeight = {
    bucket1: countWithExtra(db, ctx, [`(${sizeMb} <= ?)`], [b1], weightBuckets),
    bucket2: countWithExtra(db, ctx, [`(${sizeMb} > ? AND ${sizeMb} <= ?)`], [b1, b2], weightBuckets),
    bucket3: countWithExtra(db, ctx, [`(${sizeMb} > ? AND ${sizeMb} <= ?)`], [b2, b3], weightBuckets),
    bucket4: countWithExtra(db, ctx, [`(${sizeMb} > ?)`], [b3], weightBuckets)
  };

  const w = 'COALESCE(c.width, 0)';
  const h = 'COALESCE(c.height, 0)';
  const longSide = `CASE WHEN ${w} >= ${h} THEN ${w} ELSE ${h} END`;
  const resolution = {
    '720p': countWithExtra(db, ctx, [`(${longSide} >= 720)`], [], weightBuckets),
    '1080p': countWithExtra(db, ctx, [`(${longSide} >= 1080)`], [], weightBuckets),
    '4k': countWithExtra(db, ctx, [`(${longSide} >= 2160)`], [], weightBuckets)
  };

  const ms = 'COALESCE(c.duration_ms, 0)';
  const duration = {
    up5: countWithExtra(db, ctx, [`c.type='video'`, `(${ms} > 0 AND ${ms} <= ?)`], [5 * 60_000], weightBuckets),
    '5to15': countWithExtra(
      db,
      ctx,
      [`c.type='video'`, `(${ms} > ? AND ${ms} <= ?)`],
      [5 * 60_000, 15 * 60_000],
      weightBuckets
    ),
    '15to30': countWithExtra(
      db,
      ctx,
      [`c.type='video'`, `(${ms} > ? AND ${ms} <= ?)`],
      [15 * 60_000, 30 * 60_000],
      weightBuckets
    ),
    '30to60': countWithExtra(
      db,
      ctx,
      [`c.type='video'`, `(${ms} > ? AND ${ms} <= ?)`],
      [30 * 60_000, 60 * 60_000],
      weightBuckets
    ),
    over60: countWithExtra(db, ctx, [`c.type='video'`, `(${ms} > ?)`], [60 * 60_000], weightBuckets)
  };

  return {
    weightBuckets,
    maxDurationMs,
    hasVideo,
    aspectRatio,
    fileExtensions,
    description,
    link,
    dateAdded,
    fileWeight,
    resolution,
    duration
  };
}
