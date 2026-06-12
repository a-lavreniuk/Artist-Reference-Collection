import type Database from 'better-sqlite3';
import { openLibraryDb } from './db';
import type { DurationMeta, FileWeightMeta, ResolutionMeta } from './filterBucketLabels';
import {
  aspectRatioSql,
  buildGalleryFilterWhere,
  computeGalleryFilterBoundaries,
  dateRangeForPreset,
  emptyGalleryAdvancedFilters,
  hasAnyVideo,
  longSideSql,
  type AspectRatioFilterValue,
  type GalleryFilterBoundaries,
  type GalleryFilterQueryContext,
  type GallerySortState
} from './galleryFilters';
import type { LibraryScope } from './types';

export type GalleryFilterStats = {
  fileWeightMeta: FileWeightMeta;
  durationMeta: DurationMeta;
  resolutionMeta: ResolutionMeta;
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
  boundaries?: GalleryFilterBoundaries
): number {
  const { wh, binds } = buildGalleryFilterWhere(ctx, 'c', boundaries);
  const allWh = [...wh, ...extraWh];
  const sql = `SELECT COUNT(*) AS n FROM cards c${allWh.length ? ` WHERE ${allWh.join(' AND ')}` : ''}`;
  const row = db.prepare(sql).get(...binds, ...extraBinds) as { n: number };
  return row.n ?? 0;
}

function countWeightSegment(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  boundaries: GalleryFilterBoundaries,
  key: string
): number {
  const seg = boundaries.fileWeight.segments.find((s) => s.key === key);
  if (!seg) return 0;
  const mb = (col: string) => `(${col} * 1.0 / (1024 * 1024))`;
  const sizeMb = mb('COALESCE(c.file_size, 0)');
  if (key === 'bucket1') {
    return countWithExtra(db, ctx, [`(${sizeMb} > 0 AND ${sizeMb} <= ?)`], [seg.maxMb], boundaries);
  }
  if (key === 'bucket4') {
    return countWithExtra(db, ctx, [`(${sizeMb} > ?)`], [seg.minMb], boundaries);
  }
  return countWithExtra(
    db,
    ctx,
    [`(${sizeMb} > ? AND ${sizeMb} <= ?)`],
    [seg.minMb, seg.maxMb],
    boundaries
  );
}

function countResolutionSegment(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  boundaries: GalleryFilterBoundaries,
  key: string
): number {
  const seg = boundaries.resolution.segments.find((s) => s.key === key);
  if (!seg) return 0;
  const longSide = longSideSql('c');
  if (seg.openEnd) {
    return countWithExtra(db, ctx, [`(${longSide} > ?)`], [seg.minPx], boundaries);
  }
  if (seg.minPx === 0) {
    return countWithExtra(db, ctx, [`(${longSide} > 0 AND ${longSide} <= ?)`], [seg.maxPx], boundaries);
  }
  return countWithExtra(
    db,
    ctx,
    [`(${longSide} > ? AND ${longSide} <= ?)`],
    [seg.minPx, seg.maxPx],
    boundaries
  );
}

function countDurationSegment(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  boundaries: GalleryFilterBoundaries,
  key: string
): number {
  const seg = boundaries.duration.segments.find((s) => s.key === key);
  if (!seg) return 0;
  const ms = 'COALESCE(c.duration_ms, 0)';
  if (key === 'bucket1') {
    return countWithExtra(
      db,
      ctx,
      [`c.type='video'`, `(${ms} > 0 AND ${ms} <= ?)`],
      [seg.maxMs],
      boundaries
    );
  }
  if (key === 'bucket4') {
    return countWithExtra(db, ctx, [`c.type='video'`, `(${ms} > ?)`], [seg.minMs], boundaries);
  }
  return countWithExtra(
    db,
    ctx,
    [`c.type='video'`, `(${ms} > ? AND ${ms} <= ?)`],
    [seg.minMs, seg.maxMs],
    boundaries
  );
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
  const boundaries = computeGalleryFilterBoundaries(db);
  const hasVideo = hasAnyVideo(db);

  const aspectMap = aspectRatioSql('c');
  const aspectRatio = {} as Record<AspectRatioFilterValue, number>;
  for (const key of Object.keys(aspectMap) as AspectRatioFilterValue[]) {
    aspectRatio[key] = countWithExtra(db, ctx, [`(${aspectMap[key]})`], [], boundaries);
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
      boundaries
    );
  }

  const description = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.description,'') != '')`], [], boundaries),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.description,'') = '')`], [], boundaries)
  };
  const link = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.link_url,'') != '')`], [], boundaries),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.link_url,'') = '')`], [], boundaries)
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
      boundaries
    );
  }

  const fileWeight: Record<string, number> = {};
  for (const seg of boundaries.fileWeight.segments) {
    fileWeight[seg.key] = countWeightSegment(db, ctx, boundaries, seg.key);
  }

  const resolution: Record<string, number> = {};
  for (const seg of boundaries.resolution.segments) {
    resolution[seg.key] = countResolutionSegment(db, ctx, boundaries, seg.key);
  }

  const duration: Record<string, number> = {};
  for (const seg of boundaries.duration.segments) {
    duration[seg.key] = countDurationSegment(db, ctx, boundaries, seg.key);
  }

  return {
    fileWeightMeta: boundaries.fileWeight,
    durationMeta: boundaries.duration,
    resolutionMeta: boundaries.resolution,
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
