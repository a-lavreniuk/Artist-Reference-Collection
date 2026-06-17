import { buildFtsColumnMatchQuery, type FtsTextColumn } from './cardFts';
import type { DurationMeta, FileWeightMeta, ResolutionMeta } from './filterBucketLabels';
import {
  buildDurationSegments,
  buildResolutionSegmentsFromFineBuckets,
  buildWeightSegments,
  PIXEL_GRID,
  type NumericDistribution,
  type ResolutionFineBucket
} from './filterBucketLabels';
import type { LibraryScope } from './types';

export const GALLERY_FILTER_IDS = [
  'aspectRatio',
  'fileType',
  'description',
  'link',
  'dateAdded',
  'fileWeight',
  'resolution',
  'duration'
] as const;

export type GalleryFilterId = (typeof GALLERY_FILTER_IDS)[number];

export type GalleryOrderableSortField =
  | 'addedAt'
  | 'fileType'
  | 'fileWeight'
  | 'resolution'
  | 'duration';
export type GallerySortField = GalleryOrderableSortField | 'shuffle';
export type GallerySortDirection = 'asc' | 'desc';

export type GallerySortState = {
  field: GallerySortField;
  direction: GallerySortDirection;
  shuffleSeed?: number;
};

export type AspectRatioFilterValue = 'horizontal' | 'vertical' | 'square' | 'panoramic';
export type DescriptionFilterValue = { mode: 'has' | 'missing'; keywords?: string };
export type LinkFilterValue = { mode: 'has' | 'missing'; keywords?: string };
export type DateAddedPreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'threeMonths'
  | 'year'
  | 'custom';

export type DateAddedFilterValue =
  | { preset: Exclude<DateAddedPreset, 'custom'> }
  | { preset: 'custom'; from: string; to?: string };

export type FileWeightPreset = 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4' | 'custom';
export type FileWeightFilterValue =
  | { preset: Exclude<FileWeightPreset, 'custom'> }
  | { preset: 'custom'; minMb: number; maxMb: number };

export type ResolutionPreset = 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4' | 'custom';
export type ResolutionFilterValue =
  | { preset: Exclude<ResolutionPreset, 'custom'> }
  | { preset: 'custom'; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };

export type DurationPreset = 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4' | 'custom';
export type DurationFilterValue =
  | { preset: Exclude<DurationPreset, 'custom'> }
  | { preset: 'custom'; minSeconds: number; maxSeconds: number };

export type GalleryAdvancedFilters = {
  aspectRatios: AspectRatioFilterValue[];
  fileExtensions: string[];
  description: DescriptionFilterValue | null;
  link: LinkFilterValue | null;
  dateAdded: DateAddedFilterValue[];
  fileWeight: FileWeightFilterValue[];
  resolution: ResolutionFilterValue[];
  duration: DurationFilterValue[];
};

export type GalleryFilterLayoutItem = {
  id: GalleryFilterId;
  visible: boolean;
};

export type GalleryFilterPresetPayload = {
  version: 1;
  filters: GalleryAdvancedFilters;
  sort: GallerySortState;
  layout: GalleryFilterLayoutItem[];
};

export type GalleryFilterLayoutState = {
  order: GalleryFilterId[];
  visible: Record<GalleryFilterId, boolean>;
};

export const DEFAULT_GALLERY_SORT: GallerySortState = { field: 'addedAt', direction: 'desc' };

export function emptyGalleryAdvancedFilters(): GalleryAdvancedFilters {
  return {
    aspectRatios: [],
    fileExtensions: [],
    description: null,
    link: null,
    dateAdded: [],
    fileWeight: [],
    resolution: [],
    duration: []
  };
}

export function defaultGalleryFilterLayout(): GalleryFilterLayoutState {
  const visible = Object.fromEntries(GALLERY_FILTER_IDS.map((id) => [id, true])) as Record<
    GalleryFilterId,
    boolean
  >;
  return { order: [...GALLERY_FILTER_IDS], visible };
}

export function countActiveFilterCategories(filters: GalleryAdvancedFilters): number {
  let n = 0;
  if (filters.aspectRatios.length) n++;
  if (filters.fileExtensions.length) n++;
  if (filters.description) n++;
  if (filters.link) n++;
  if (filters.dateAdded.length) n++;
  if (filters.fileWeight.length) n++;
  if (filters.resolution.length) n++;
  if (filters.duration.length) n++;
  return n;
}

export type GalleryFilterQueryContext = {
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  filters: GalleryAdvancedFilters;
  sort: GallerySortState;
};

export type GalleryFilterBoundaries = {
  fileWeight: FileWeightMeta;
  duration: DurationMeta;
  resolution: ResolutionMeta;
};

/** @deprecated Используйте fileWeight из GalleryFilterBoundaries */
export type FileWeightBuckets = {
  maxMb: number;
  b1: number;
  b2: number;
  b3: number;
};

function percentileValue(
  db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } },
  column: string,
  whereSql: string,
  percentile: number
): number {
  const countRow = db
    .prepare(`SELECT COUNT(*) AS n FROM cards c WHERE ${whereSql}`)
    .get() as { n: number };
  const count = countRow?.n ?? 0;
  if (count <= 0) return 0;
  const offset = Math.max(0, Math.min(count - 1, Math.floor(count * percentile)));
  const row = db
    .prepare(`SELECT ${column} AS v FROM cards c WHERE ${whereSql} ORDER BY ${column} LIMIT 1 OFFSET ?`)
    .get(offset) as { v: number | null };
  return typeof row?.v === 'number' && row.v > 0 ? row.v : 0;
}

function getNumericDistribution(
  db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } },
  column: string,
  whereSql: string
): NumericDistribution | null {
  const minMax = db
    .prepare(`SELECT MIN(${column}) AS minV, MAX(${column}) AS maxV FROM cards c WHERE ${whereSql}`)
    .get() as { minV: number | null; maxV: number | null };
  const min = typeof minMax?.minV === 'number' && minMax.minV > 0 ? minMax.minV : 0;
  const max = typeof minMax?.maxV === 'number' && minMax.maxV > 0 ? minMax.maxV : 0;
  if (max <= 0) return null;
  return {
    min,
    max,
    p25: percentileValue(db, column, whereSql, 0.25) || min,
    p50: percentileValue(db, column, whereSql, 0.5) || min,
    p75: percentileValue(db, column, whereSql, 0.75) || max
  };
}

export function getFileSizeDistribution(db: Parameters<typeof getMaxFileSizeBytes>[0]): NumericDistribution | null {
  return getNumericDistribution(
    db,
    'COALESCE(c.file_size, 0)',
    'COALESCE(c.is_deleted, 0) = 0 AND COALESCE(c.file_size, 0) > 0'
  );
}

export function getVideoDurationDistribution(
  db: Parameters<typeof getMaxDurationMs>[0]
): NumericDistribution | null {
  return getNumericDistribution(
    db,
    'COALESCE(c.duration_ms, 0)',
    "COALESCE(c.is_deleted, 0) = 0 AND c.type = 'video' AND COALESCE(c.duration_ms, 0) > 0"
  );
}

export function longSideSql(alias = 'c'): string {
  const w = `COALESCE(${alias}.width, 0)`;
  const h = `COALESCE(${alias}.height, 0)`;
  return `CASE WHEN ${w} >= ${h} THEN ${w} ELSE ${h} END`;
}

const RESOLUTION_DIMENSION_WHERE =
  'COALESCE(c.is_deleted, 0) = 0 AND COALESCE(c.width, 0) > 0 AND COALESCE(c.height, 0) > 0';

export function getLongSideDistribution(
  db: Parameters<typeof getMaxFileSizeBytes>[0]
): NumericDistribution | null {
  return getNumericDistribution(db, longSideSql('c'), RESOLUTION_DIMENSION_WHERE);
}

type SqliteGetDb = {
  prepare: (sql: string) => { get: (...args: unknown[]) => unknown };
};

export function computeResolutionFineBuckets(
  db: SqliteGetDb
): { minPx: number; maxPx: number; buckets: ResolutionFineBucket[] } {
  const longSide = longSideSql('c');
  const dist = getLongSideDistribution(db);
  if (!dist) return { minPx: 0, maxPx: 0, buckets: [] };

  const minPx = Math.round(dist.min);
  const maxPx = Math.round(dist.max);
  if (maxPx <= 0) return { minPx: 0, maxPx: 0, buckets: [] };

  const countLoHi = (lo: number, hi: number) => {
    if (lo === 0) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM cards c WHERE ${RESOLUTION_DIMENSION_WHERE} AND (${longSide} > 0 AND ${longSide} <= ?)`
        )
        .get(hi) as { n: number };
      return row?.n ?? 0;
    }
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM cards c WHERE ${RESOLUTION_DIMENSION_WHERE} AND (${longSide} > ? AND ${longSide} <= ?)`
      )
      .get(lo, hi) as { n: number };
    return row?.n ?? 0;
  };

  const gridSplits = PIXEL_GRID.filter((g) => g >= minPx && g < maxPx);
  const buckets: ResolutionFineBucket[] = [];
  let prev = 0;

  for (const hi of gridSplits) {
    buckets.push({ minPx: prev, maxPx: hi, count: countLoHi(prev, hi) });
    prev = hi;
  }

  if (gridSplits.length === 0) {
    buckets.push({ minPx: 0, maxPx: maxPx, count: countLoHi(0, maxPx) });
    return { minPx, maxPx, buckets };
  }

  const tailRow = db
    .prepare(`SELECT COUNT(*) AS n FROM cards c WHERE ${RESOLUTION_DIMENSION_WHERE} AND (${longSide} > ?)`)
    .get(prev) as { n: number };
  const tailCount = tailRow?.n ?? 0;
  if (tailCount > 0) {
    buckets.push({ minPx: prev, maxPx: maxPx, count: tailCount, openEnd: true });
  }

  return { minPx, maxPx, buckets };
}

export function computeGalleryFilterBoundaries(
  db: Parameters<typeof getMaxFileSizeBytes>[0]
): GalleryFilterBoundaries {
  const resolutionFine = computeResolutionFineBuckets(db);
  return {
    fileWeight: buildWeightSegments(getFileSizeDistribution(db)),
    duration: buildDurationSegments(getVideoDurationDistribution(db)),
    resolution: buildResolutionSegmentsFromFineBuckets(
      resolutionFine.buckets,
      resolutionFine.minPx,
      resolutionFine.maxPx
    )
  };
}

/** @deprecated Используйте computeGalleryFilterBoundaries */
export function computeFileWeightBuckets(maxBytes: number): FileWeightBuckets {
  const maxMb = Math.max(0.1, Math.round((maxBytes / (1024 * 1024)) * 10) / 10);
  const step = Math.round((maxMb / 4) * 10) / 10;
  return {
    maxMb,
    b1: step,
    b2: step * 2,
    b3: step * 3
  };
}

function findWeightSegment(meta: FileWeightMeta, key: string) {
  return meta.segments.find((s) => s.key === key);
}

function findDurationSegment(meta: DurationMeta, key: string) {
  return meta.segments.find((s) => s.key === key);
}

function findResolutionSegment(meta: ResolutionMeta, key: string) {
  return meta.segments.find((s) => s.key === key);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dateRangeForPreset(preset: DateAddedPreset, now = new Date()): { from: Date; to: Date } {
  const today = startOfLocalDay(now);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  switch (preset) {
    case 'today':
      return { from: today, to: end };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yEnd = new Date(today);
      yEnd.setMilliseconds(yEnd.getMilliseconds() - 1);
      return { from: y, to: yEnd };
    }
    case 'week': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: end };
    }
    case 'month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'threeMonths': {
      const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'year': {
      const from = new Date(today.getFullYear(), 0, 1);
      const to = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from, to };
    }
    default:
      return { from: today, to: end };
  }
}

export function aspectRatioSql(alias: string): Record<AspectRatioFilterValue, string> {
  const w = `COALESCE(${alias}.width, 0)`;
  const h = `COALESCE(${alias}.height, 0)`;
  return {
    horizontal: `(${w} > ${h} AND ${h} > 0 AND (${w} * 1.0 / ${h}) < 2)`,
    vertical: `(${h} > ${w})`,
    square: `(${w} = ${h} AND ${w} > 0)`,
    panoramic: `(${w} >= 2 * ${h} AND ${h} > 0)`
  };
}

function appendKeywordsCondition(
  wh: string[],
  binds: unknown[],
  alias: string,
  column: FtsTextColumn,
  keywords: string | undefined
): void {
  const match = buildFtsColumnMatchQuery(column, keywords);
  if (!match) return;
  wh.push(`${alias}.id IN (SELECT card_id FROM cards_fts WHERE cards_fts MATCH ?)`);
  binds.push(match);
}

export function buildGalleryFilterWhere(
  ctx: GalleryFilterQueryContext,
  alias = 'c',
  boundaries?: GalleryFilterBoundaries
): { wh: string[]; binds: unknown[] } {
  const wh: string[] = [];
  const binds: unknown[] = [];
  const f = ctx.filters;

  appendLibraryScopeSql(ctx.libraryScope, wh, alias);

  const tagIds = (ctx.selectedTagIds ?? []).filter((t) => t.trim());
  if (tagIds.length) {
    wh.push(
      `${alias}.id IN (
        SELECT card_id FROM card_tags WHERE tag_id IN (${tagIds.map(() => '?').join(',')})
        GROUP BY card_id HAVING COUNT(DISTINCT tag_id) = ?
      )`
    );
    binds.push(...tagIds, tagIds.length);
  }

  const collectionId = ctx.collectionId?.trim() ?? '';
  if (collectionId) {
    wh.push(
      `${alias}.id IN (SELECT card_id FROM card_collections WHERE collection_id = ?)`
    );
    binds.push(collectionId);
  }

  const moodboardIds = ctx.moodboardCardIds?.filter(Boolean) ?? [];
  if (moodboardIds.length) {
    wh.push(`${alias}.id IN (${moodboardIds.map(() => '?').join(',')})`);
    binds.push(...moodboardIds);
  }

  const cardExact = ctx.cardIdExact?.trim() ?? '';
  if (cardExact) {
    wh.push(`${alias}.id = ?`);
    binds.push(cardExact);
  }

  if (f.aspectRatios.length) {
    const map = aspectRatioSql(alias);
    const parts = f.aspectRatios.map((v) => `(${map[v]})`);
    wh.push(`(${parts.join(' OR ')})`);
  }

  if (f.fileExtensions.length) {
    const exts = f.fileExtensions.map((e) => e.toLowerCase().replace(/^\./, ''));
    wh.push(
      `LOWER(COALESCE(${alias}.format, '')) IN (${exts.map(() => '?').join(',')})`
    );
    binds.push(...exts);
  }

  if (f.description) {
    if (f.description.mode === 'missing') {
      wh.push(`(COALESCE(${alias}.description, '') = '')`);
    } else {
      wh.push(`(COALESCE(${alias}.description, '') != '')`);
      appendKeywordsCondition(wh, binds, alias, 'description', f.description.keywords);
    }
  }

  if (f.link) {
    if (f.link.mode === 'missing') {
      wh.push(`(COALESCE(${alias}.link_url, '') = '')`);
    } else {
      wh.push(`(COALESCE(${alias}.link_url, '') != '')`);
      appendKeywordsCondition(wh, binds, alias, 'link_url', f.link.keywords);
    }
  }

  if (f.dateAdded.length) {
    const dateParts: string[] = [];
    for (const d of f.dateAdded) {
      if (d.preset === 'custom') {
        const from = d.from;
        const to = d.to ?? d.from;
        dateParts.push(`(${alias}.added_at >= ? AND ${alias}.added_at <= ?)`);
        binds.push(from, to.length === 10 ? `${to}T23:59:59.999Z` : to);
      } else {
        const { from, to } = dateRangeForPreset(d.preset);
        dateParts.push(`(${alias}.added_at >= ? AND ${alias}.added_at <= ?)`);
        binds.push(from.toISOString(), to.toISOString());
      }
    }
    wh.push(`(${dateParts.join(' OR ')})`);
  }

  if (f.fileWeight.length && boundaries) {
    const mb = (col: string) => `(${col} * 1.0 / (1024 * 1024))`;
    const sizeMb = mb(`COALESCE(${alias}.file_size, 0)`);
    const parts: string[] = [];
    for (const w of f.fileWeight) {
      if (w.preset === 'custom') {
        parts.push(`(${sizeMb} >= ? AND ${sizeMb} <= ?)`);
        binds.push(w.minMb, w.maxMb);
        continue;
      }
      const seg = findWeightSegment(boundaries.fileWeight, w.preset);
      if (!seg) continue;
      if (w.preset === 'bucket1') {
        parts.push(`(${sizeMb} > 0 AND ${sizeMb} <= ?)`);
        binds.push(seg.maxMb);
      } else if (w.preset === 'bucket4') {
        parts.push(`(${sizeMb} > ?)`);
        binds.push(seg.minMb);
      } else {
        parts.push(`(${sizeMb} > ? AND ${sizeMb} <= ?)`);
        binds.push(seg.minMb, seg.maxMb);
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }

  if (f.resolution.length) {
    const w = `COALESCE(${alias}.width, 0)`;
    const h = `COALESCE(${alias}.height, 0)`;
    const longSide = longSideSql(alias);
    const parts: string[] = [];
    for (const r of f.resolution) {
      if (r.preset === 'custom') {
        const conds: string[] = [];
        if (r.minWidth != null) {
          conds.push(`${w} >= ?`);
          binds.push(r.minWidth);
        }
        if (r.maxWidth != null) {
          conds.push(`${w} <= ?`);
          binds.push(r.maxWidth);
        }
        if (r.minHeight != null) {
          conds.push(`${h} >= ?`);
          binds.push(r.minHeight);
        }
        if (r.maxHeight != null) {
          conds.push(`${h} <= ?`);
          binds.push(r.maxHeight);
        }
        if (conds.length) parts.push(`(${conds.join(' AND ')})`);
        continue;
      }
      if (!boundaries) continue;
      const seg = findResolutionSegment(boundaries.resolution, r.preset);
      if (!seg) continue;
      if (seg.openEnd) {
        parts.push(`(${longSide} > ?)`);
        binds.push(seg.minPx);
      } else if (seg.minPx === 0) {
        parts.push(`(${longSide} > 0 AND ${longSide} <= ?)`);
        binds.push(seg.maxPx);
      } else {
        parts.push(`(${longSide} > ? AND ${longSide} <= ?)`);
        binds.push(seg.minPx, seg.maxPx);
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }

  if (f.duration.length && boundaries) {
    wh.push(`${alias}.type = 'video'`);
    const ms = `COALESCE(${alias}.duration_ms, 0)`;
    const parts: string[] = [];
    for (const d of f.duration) {
      if (d.preset === 'custom') {
        parts.push(`(${ms} >= ? AND ${ms} <= ?)`);
        binds.push(d.minSeconds * 1000, d.maxSeconds * 1000);
        continue;
      }
      const seg = findDurationSegment(boundaries.duration, d.preset);
      if (!seg) continue;
      if (d.preset === 'bucket1') {
        parts.push(`(${ms} > 0 AND ${ms} <= ?)`);
        binds.push(seg.maxMs);
      } else if (d.preset === 'bucket4') {
        parts.push(`(${ms} > ?)`);
        binds.push(seg.minMs);
      } else {
        parts.push(`(${ms} > ? AND ${ms} <= ?)`);
        binds.push(seg.minMs, seg.maxMs);
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }

  if (ctx.sort.field === 'duration') {
    wh.push(`${alias}.type = 'video'`);
  }

  return { wh, binds };
}

export function buildGallerySortSql(sort: GallerySortState, alias = 'c'): string {
  const dir = sort.direction === 'asc' ? 'ASC' : 'DESC';
  switch (sort.field) {
    case 'fileType':
      return `ORDER BY ${alias}.type ${dir}, ${alias}.format ${dir}, ${alias}.added_at DESC`;
    case 'fileWeight':
      return `ORDER BY COALESCE(${alias}.file_size, 0) ${dir}, ${alias}.added_at DESC`;
    case 'resolution':
      return `ORDER BY CASE WHEN COALESCE(${alias}.width,0) >= COALESCE(${alias}.height,0) THEN COALESCE(${alias}.width,0) ELSE COALESCE(${alias}.height,0) END ${dir}, ${alias}.added_at DESC`;
    case 'duration':
      return `ORDER BY COALESCE(${alias}.duration_ms, 0) ${dir}, ${alias}.added_at DESC`;
    case 'shuffle':
      return `ORDER BY ${alias}.added_at DESC`;
    case 'addedAt':
    default:
      return `ORDER BY ${alias}.added_at ${dir}`;
  }
}

function appendLibraryScopeSql(scope: LibraryScope | undefined, wh: string[], alias: string): void {
  const s = scope ?? 'all';
  if (s === 'trash') {
    wh.push(`COALESCE(${alias}.is_deleted, 0) = 1`);
    return;
  }
  wh.push(`COALESCE(${alias}.is_deleted, 0) = 0`);
  if (s === 'untagged') {
    wh.push(`NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = ${alias}.id)`);
  }
}

export function getMaxFileSizeBytes(db: { prepare: (sql: string) => { get: () => unknown } }): number {
  const row = db.prepare('SELECT MAX(file_size) AS m FROM cards WHERE COALESCE(is_deleted,0)=0').get() as
    | { m: number | null }
    | undefined;
  return typeof row?.m === 'number' && row.m > 0 ? row.m : 0;
}

export function getMaxDurationMs(db: { prepare: (sql: string) => { get: () => unknown } }): number {
  const row = db
    .prepare("SELECT MAX(duration_ms) AS m FROM cards WHERE type='video' AND COALESCE(is_deleted,0)=0")
    .get() as { m: number | null } | undefined;
  return typeof row?.m === 'number' && row.m > 0 ? row.m : 0;
}

export function hasAnyVideo(db: { prepare: (sql: string) => { get: () => unknown } }): boolean {
  const row = db
    .prepare("SELECT 1 AS n FROM cards WHERE type='video' AND COALESCE(is_deleted,0)=0 LIMIT 1")
    .get();
  return Boolean(row);
}
