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

export type GallerySortField = 'addedAt' | 'fileType' | 'fileWeight' | 'resolution' | 'duration';
export type GallerySortDirection = 'asc' | 'desc';

export type GallerySortState = {
  field: GallerySortField;
  direction: GallerySortDirection;
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

export type ResolutionPreset = '720p' | '1080p' | '4k' | 'custom';
export type ResolutionFilterValue =
  | { preset: Exclude<ResolutionPreset, 'custom'> }
  | { preset: 'custom'; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };

export type DurationPreset = 'up5' | '5to15' | '15to30' | '30to60' | 'over60' | 'custom';
export type DurationFilterValue =
  | { preset: Exclude<DurationPreset, 'custom'> }
  | { preset: 'custom'; minMinutes: number; maxMinutes: number };

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

export type FileWeightBuckets = {
  maxMb: number;
  b1: number;
  b2: number;
  b3: number;
};

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
  column: string,
  keywords: string | undefined
): void {
  const parts = (keywords ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const word of parts) {
    wh.push(`LOWER(COALESCE(${column}, '')) LIKE ?`);
    binds.push(`%${word.toLowerCase()}%`);
  }
}

export function buildGalleryFilterWhere(
  ctx: GalleryFilterQueryContext,
  alias = 'c',
  weightBuckets?: FileWeightBuckets
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
      appendKeywordsCondition(wh, binds, `${alias}.description`, f.description.keywords);
    }
  }

  if (f.link) {
    if (f.link.mode === 'missing') {
      wh.push(`(COALESCE(${alias}.link_url, '') = '')`);
    } else {
      wh.push(`(COALESCE(${alias}.link_url, '') != '')`);
      appendKeywordsCondition(wh, binds, `${alias}.link_url`, f.link.keywords);
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

  if (f.fileWeight.length && weightBuckets) {
    const { b1, b2, b3, maxMb } = weightBuckets;
    const mb = (col: string) => `(${col} * 1.0 / (1024 * 1024))`;
    const sizeMb = mb(`COALESCE(${alias}.file_size, 0)`);
    const parts: string[] = [];
    for (const w of f.fileWeight) {
      if (w.preset === 'custom') {
        parts.push(`(${sizeMb} >= ? AND ${sizeMb} <= ?)`);
        binds.push(w.minMb, w.maxMb);
      } else if (w.preset === 'bucket1') {
        parts.push(`(${sizeMb} <= ?)`);
        binds.push(b1);
      } else if (w.preset === 'bucket2') {
        parts.push(`(${sizeMb} > ? AND ${sizeMb} <= ?)`);
        binds.push(b1, b2);
      } else if (w.preset === 'bucket3') {
        parts.push(`(${sizeMb} > ? AND ${sizeMb} <= ?)`);
        binds.push(b2, b3);
      } else if (w.preset === 'bucket4') {
        parts.push(`(${sizeMb} > ?)`);
        binds.push(b3);
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }

  if (f.resolution.length) {
    const w = `COALESCE(${alias}.width, 0)`;
    const h = `COALESCE(${alias}.height, 0)`;
    const longSide = `CASE WHEN ${w} >= ${h} THEN ${w} ELSE ${h} END`;
    const parts: string[] = [];
    for (const r of f.resolution) {
      if (r.preset === '720p') parts.push(`(${longSide} >= 720)`);
      else if (r.preset === '1080p') parts.push(`(${longSide} >= 1080)`);
      else if (r.preset === '4k') parts.push(`(${longSide} >= 2160)`);
      else if (r.preset === 'custom') {
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
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }

  if (f.duration.length) {
    wh.push(`${alias}.type = 'video'`);
    const ms = `COALESCE(${alias}.duration_ms, 0)`;
    const parts: string[] = [];
    for (const d of f.duration) {
      if (d.preset === 'custom') {
        parts.push(`(${ms} >= ? AND ${ms} <= ?)`);
        binds.push(d.minMinutes * 60_000, d.maxMinutes * 60_000);
      } else if (d.preset === 'up5') {
        parts.push(`(${ms} > 0 AND ${ms} <= ?)`);
        binds.push(5 * 60_000);
      } else if (d.preset === '5to15') {
        parts.push(`(${ms} > ? AND ${ms} <= ?)`);
        binds.push(5 * 60_000, 15 * 60_000);
      } else if (d.preset === '15to30') {
        parts.push(`(${ms} > ? AND ${ms} <= ?)`);
        binds.push(15 * 60_000, 30 * 60_000);
      } else if (d.preset === '30to60') {
        parts.push(`(${ms} > ? AND ${ms} <= ?)`);
        binds.push(30 * 60_000, 60 * 60_000);
      } else if (d.preset === 'over60') {
        parts.push(`(${ms} > ?)`);
        binds.push(60 * 60_000);
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
