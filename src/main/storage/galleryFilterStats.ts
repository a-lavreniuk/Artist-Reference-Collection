import type Database from 'better-sqlite3';
import { waitForNavigationIpc } from '../ipcNavigationPriority';
import { openLibraryDb } from './db';
import type { DurationMeta, FileWeightMeta, ResolutionMeta } from './filterBucketLabels';
import {
  aspectRatioSql,
  buildGalleryFilterWhere,
  dateRangeForPreset,
  emptyGalleryAdvancedFilters,
  hasAnyVideo,
  longSideSql,
  type AspectRatioFilterValue,
  type GalleryFilterBoundaries,
  type GalleryFilterQueryContext,
  type GallerySortState
} from './galleryFilters';
import { getOrComputeGalleryFilterBoundaries } from './galleryFilterBoundariesCache';
import type { LibraryScope } from './types';
import { readLibraryDetailTemplate } from './librarySettings';
import { fieldHasValueSql, fieldMissingValueSql, fieldValueSql } from './galleryCustomFieldSql';
import type { DetailCardTemplateV1 } from '../shared/detailCardTemplate';

export type GalleryFilterStats = {
  fileWeightMeta: FileWeightMeta;
  durationMeta: DurationMeta;
  resolutionMeta: ResolutionMeta;
  hasVideo: boolean;
  aspectRatio: Record<AspectRatioFilterValue, number>;
  fileExtensions: Record<string, number>;
  annotations: { has: number; missing: number };
  tagPresence: { tagged: number; untagged: number };
  dateAdded: Record<string, number>;
  fileWeight: Record<string, number>;
  resolution: Record<string, number>;
  duration: Record<string, number>;
  rating: Record<string, number>;
  customPresence: Record<string, { has: number; missing: number }>;
  customSelect: Record<string, Record<string, number>>;
};

function collectCustomFieldStats(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  boundaries: GalleryFilterBoundaries,
  template: DetailCardTemplateV1
): {
  customPresence: Record<string, { has: number; missing: number }>;
  customSelect: Record<string, Record<string, number>>;
} {
  const customPresence: Record<string, { has: number; missing: number }> = {};
  const customSelect: Record<string, Record<string, number>> = {};
  for (const field of template.fields) {
    if (!field.showInFilters) continue;
    const hasSql = fieldHasValueSql(field, 'c');
    const missSql = fieldMissingValueSql(field, 'c');
    if (!hasSql || !missSql) continue;
    const has = countWithExtra(db, ctx, [hasSql], [], boundaries);
    const missing = countWithExtra(db, ctx, [missSql], [], boundaries);
    customPresence[field.id] = { has, missing };
    if (field.type !== 'select' && field.type !== 'multiSelect') continue;
    const counts: Record<string, number> = {};
    const expr = fieldValueSql(field, 'c');
    for (const opt of field.options ?? []) {
      if (field.type === 'multiSelect') {
        counts[opt] = countWithExtra(
          db,
          ctx,
          [
            `EXISTS (
              SELECT 1 FROM json_each(json_extract(c.custom_fields_json, '$.${field.id}'))
              WHERE json_each.value = ?
            )`
          ],
          [opt],
          boundaries
        );
      } else if (expr) {
        counts[opt] = countWithExtra(db, ctx, [`(${expr} = ?)`], [opt], boundaries);
      }
    }
    customSelect[field.id] = counts;
  }
  return { customPresence, customSelect };
}

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

function countRatings(
  db: Database.Database,
  ctx: GalleryFilterQueryContext,
  boundaries: GalleryFilterBoundaries
): Record<string, number> {
  const rating: Record<string, number> = {};
  for (const value of [0, 1, 2, 3, 4, 5]) {
    rating[String(value)] = countWithExtra(db, ctx, ['COALESCE(c.rating, 0) = ?'], [value], boundaries);
  }
  return rating;
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
  const template = readLibraryDetailTemplate(db);
  const ctx = {
    ...baseContext(
      opts.libraryScope ?? 'all',
      opts.selectedTagIds ?? [],
      opts.cardIdExact ?? null,
      opts.collectionId ?? null,
      opts.moodboardCardIds ?? null
    ),
    template
  };
  const boundaries = getOrComputeGalleryFilterBoundaries(db);
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

  const annotations = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.annotations_text,'') != '')`], [], boundaries),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.annotations_text,'') = '')`], [], boundaries)
  };
  const tagPresence = {
    tagged: countWithExtra(
      db,
      ctx,
      [`EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id)`],
      [],
      boundaries
    ),
    untagged: countWithExtra(
      db,
      ctx,
      [`NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id)`],
      [],
      boundaries
    )
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

  const rating = countRatings(db, ctx, boundaries);
  const customStats = collectCustomFieldStats(db, ctx, boundaries, template);

  return {
    fileWeightMeta: boundaries.fileWeight,
    durationMeta: boundaries.duration,
    resolutionMeta: boundaries.resolution,
    hasVideo,
    aspectRatio,
    fileExtensions,
    annotations,
    tagPresence,
    dateAdded,
    fileWeight,
    resolution,
    duration,
    rating,
    ...customStats
  };
}

class FilterStatsAborted extends Error {
  override readonly name = 'FilterStatsAborted';
}

async function cooperativeYield(shouldAbort: () => boolean): Promise<void> {
  await waitForNavigationIpc();
  if (shouldAbort()) throw new FilterStatsAborted();
  await new Promise<void>((resolve) => setImmediate(resolve));
  if (shouldAbort()) throw new FilterStatsAborted();
}

/** Не блокирует sendSync list-cards — уступает event loop между пачками COUNT. */
export async function getGalleryFilterStatsAsync(
  libraryRoot: string,
  opts: {
    libraryScope?: LibraryScope;
    selectedTagIds?: string[];
    cardIdExact?: string | null;
    collectionId?: string | null;
    moodboardCardIds?: string[] | null;
  },
  shouldAbort: () => boolean
): Promise<GalleryFilterStats> {
  const db = openLibraryDb(libraryRoot);
  const template = readLibraryDetailTemplate(db);
  const ctx = {
    ...baseContext(
      opts.libraryScope ?? 'all',
      opts.selectedTagIds ?? [],
      opts.cardIdExact ?? null,
      opts.collectionId ?? null,
      opts.moodboardCardIds ?? null
    ),
    template
  };

  await cooperativeYield(shouldAbort);
  const boundaries = getOrComputeGalleryFilterBoundaries(db);
  const hasVideo = hasAnyVideo(db);

  await cooperativeYield(shouldAbort);
  const aspectMap = aspectRatioSql('c');
  const aspectRatio = {} as Record<AspectRatioFilterValue, number>;
  for (const key of Object.keys(aspectMap) as AspectRatioFilterValue[]) {
    aspectRatio[key] = countWithExtra(db, ctx, [`(${aspectMap[key]})`], [], boundaries);
  }
  await cooperativeYield(shouldAbort);
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
  await cooperativeYield(shouldAbort);
  const annotations = {
    has: countWithExtra(db, ctx, [`(COALESCE(c.annotations_text,'') != '')`], [], boundaries),
    missing: countWithExtra(db, ctx, [`(COALESCE(c.annotations_text,'') = '')`], [], boundaries)
  };
  await cooperativeYield(shouldAbort);
  const tagPresence = {
    tagged: countWithExtra(
      db,
      ctx,
      [`EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id)`],
      [],
      boundaries
    ),
    untagged: countWithExtra(
      db,
      ctx,
      [`NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id)`],
      [],
      boundaries
    )
  };
  await cooperativeYield(shouldAbort);
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
  await cooperativeYield(shouldAbort);
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

  await cooperativeYield(shouldAbort);
  const rating = countRatings(db, ctx, boundaries);
  const customStats = collectCustomFieldStats(db, ctx, boundaries, template);

  return {
    fileWeightMeta: boundaries.fileWeight,
    durationMeta: boundaries.duration,
    resolutionMeta: boundaries.resolution,
    hasVideo,
    aspectRatio,
    fileExtensions,
    annotations,
    tagPresence,
    dateAdded,
    fileWeight,
    resolution,
    duration,
    rating,
    ...customStats
  };
}

export { FilterStatsAborted };
