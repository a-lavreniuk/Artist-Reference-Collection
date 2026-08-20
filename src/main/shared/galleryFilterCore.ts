/** Shared gallery filter types — single source for renderer and main process. */

export const GALLERY_FILTER_IDS = [
  'aspectRatio',
  'fileType',
  'tagPresence',
  'dateAdded',
  'fileWeight',
  'resolution',
  'duration',
  'rating',
  'annotations'
] as const;

export type GalleryFilterId = (typeof GALLERY_FILTER_IDS)[number];

export const GALLERY_ORDERABLE_SORT_FIELDS = [
  'addedAt',
  'fileType',
  'fileWeight',
  'resolution',
  'duration',
  'rating'
] as const;

export type GalleryOrderableSortField = (typeof GALLERY_ORDERABLE_SORT_FIELDS)[number];
export type GallerySortField = GalleryOrderableSortField | 'shuffle' | `custom:${string}`;
export type GallerySortDirection = 'asc' | 'desc';

export type GallerySortState = {
  field: GallerySortField;
  direction: GallerySortDirection;
  shuffleSeed?: number;
};

export type AspectRatioFilterValue = 'horizontal' | 'vertical' | 'square' | 'panoramic';
export type DescriptionFilterValue = { mode: 'has' | 'missing'; keywords?: string };
export type LinkFilterValue = { mode: 'has' | 'missing'; keywords?: string };
export type AnnotationsFilterValue = { mode: 'has' | 'missing'; keywords?: string };
/** Наличие любых меток на карточке (≥1). */
export type TagPresenceFilterValue = 'tagged' | 'untagged';
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

/** Оценка карточки: конкретные значения, 0 = «Без оценки». */
export type RatingFilterValue = { value: 0 | 1 | 2 | 3 | 4 | 5 };

export type DurationPreset = 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4' | 'custom';
export type DurationFilterValue =
  | { preset: Exclude<DurationPreset, 'custom'> }
  | { preset: 'custom'; minSeconds: number; maxSeconds: number };

export type CustomPresenceFilterValue = { mode: 'has' | 'missing'; keywords?: string };
export type CustomSelectFilterValue = { values: string[] };
export type CustomDateFilterValue = { ranges: DateAddedFilterValue[] };
export type CustomFieldFilterValue =
  | CustomPresenceFilterValue
  | CustomSelectFilterValue
  | CustomDateFilterValue;

export type GalleryAdvancedFilters = {
  aspectRatios: AspectRatioFilterValue[];
  fileExtensions: string[];
  tagPresence: TagPresenceFilterValue | null;
  dateAdded: DateAddedFilterValue[];
  fileWeight: FileWeightFilterValue[];
  resolution: ResolutionFilterValue[];
  duration: DurationFilterValue[];
  rating: RatingFilterValue[];
  annotations: AnnotationsFilterValue | null;
  custom: Record<string, CustomFieldFilterValue>;
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
  /** Пользовательские фильтры: false — скрыть чип, строка в настройках остаётся. Нет ключа = видно. */
  userVisible?: Record<string, boolean>;
};

export const DEFAULT_GALLERY_SORT: GallerySortState = { field: 'addedAt', direction: 'desc' };

export function emptyGalleryAdvancedFilters(): GalleryAdvancedFilters {
  return {
    aspectRatios: [],
    fileExtensions: [],
    tagPresence: null,
    dateAdded: [],
    fileWeight: [],
    resolution: [],
    duration: [],
    rating: [],
    annotations: null,
    custom: {}
  };
}

export function defaultGalleryFilterLayout(): GalleryFilterLayoutState {
  const visible = Object.fromEntries(GALLERY_FILTER_IDS.map((id) => [id, true])) as Record<
    GalleryFilterId,
    boolean
  >;
  return { order: [...GALLERY_FILTER_IDS], visible };
}

export function sanitizeUserFilterVisible(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key) continue;
    out[key] = value !== false;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function isUserFilterBarVisible(layout: GalleryFilterLayoutState, fieldId: string): boolean {
  return layout.userVisible?.[fieldId] !== false;
}

export function isCustomPresenceFilter(
  value: CustomFieldFilterValue | undefined
): value is CustomPresenceFilterValue {
  return Boolean(value && 'mode' in value);
}

export function isCustomSelectFilter(
  value: CustomFieldFilterValue | undefined
): value is CustomSelectFilterValue {
  return Boolean(value && 'values' in value);
}

export function isCustomDateFilter(
  value: CustomFieldFilterValue | undefined
): value is CustomDateFilterValue {
  return Boolean(value && 'ranges' in value);
}

export function isCustomFieldFilterActive(value: CustomFieldFilterValue | undefined): boolean {
  if (!value) return false;
  if (isCustomPresenceFilter(value)) return true;
  if (isCustomSelectFilter(value)) return value.values.length > 0;
  if (isCustomDateFilter(value)) return value.ranges.length > 0;
  return false;
}

export function countActiveFilterCategories(filters: GalleryAdvancedFilters): number {
  let n = 0;
  if (filters.aspectRatios.length) n++;
  if (filters.fileExtensions.length) n++;
  if (filters.tagPresence) n++;
  if (filters.dateAdded.length) n++;
  if (filters.fileWeight.length) n++;
  if (filters.resolution.length) n++;
  if (filters.duration.length) n++;
  if (filters.rating.length) n++;
  if (filters.annotations) n++;
  for (const value of Object.values(filters.custom ?? {})) {
    if (isCustomFieldFilterActive(value)) n++;
  }
  return n;
}

export function isGalleryShuffleSort(sort: GallerySortState): boolean {
  return sort.field === 'shuffle';
}

export function customSortFieldId(fieldId: string): `custom:${string}` {
  return `custom:${fieldId}`;
}

export function parseCustomSortFieldId(field: string): string | null {
  if (!field.startsWith('custom:')) return null;
  const id = field.slice('custom:'.length);
  return id || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateLegacyPresence(
  raw: unknown
): CustomPresenceFilterValue | null {
  if (!isRecord(raw)) return null;
  if (raw.mode !== 'has' && raw.mode !== 'missing') return null;
  const next: CustomPresenceFilterValue = { mode: raw.mode };
  if (typeof raw.keywords === 'string') next.keywords = raw.keywords;
  return next;
}

function migrateCustomFieldFilterValue(raw: unknown): CustomFieldFilterValue | null {
  if (!isRecord(raw)) return null;
  if (raw.mode === 'has' || raw.mode === 'missing') {
    return migrateLegacyPresence(raw);
  }
  if (Array.isArray(raw.values)) {
    return {
      values: raw.values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    };
  }
  if (Array.isArray(raw.ranges)) {
    return { ranges: raw.ranges as DateAddedFilterValue[] };
  }
  return null;
}

/** Переносит старые системные description/link в custom и нормализует custom. */
export function migrateGalleryAdvancedFiltersShape(raw: unknown): GalleryAdvancedFilters {
  const base = emptyGalleryAdvancedFilters();
  if (!isRecord(raw)) return base;
  const next: GalleryAdvancedFilters = {
    ...base,
    aspectRatios: Array.isArray(raw.aspectRatios) ? (raw.aspectRatios as AspectRatioFilterValue[]) : [],
    fileExtensions: Array.isArray(raw.fileExtensions) ? (raw.fileExtensions as string[]) : [],
    tagPresence:
      raw.tagPresence === 'tagged' || raw.tagPresence === 'untagged' ? raw.tagPresence : null,
    dateAdded: Array.isArray(raw.dateAdded) ? (raw.dateAdded as DateAddedFilterValue[]) : [],
    fileWeight: Array.isArray(raw.fileWeight) ? (raw.fileWeight as FileWeightFilterValue[]) : [],
    resolution: Array.isArray(raw.resolution) ? (raw.resolution as ResolutionFilterValue[]) : [],
    duration: Array.isArray(raw.duration) ? (raw.duration as DurationFilterValue[]) : [],
    rating: Array.isArray(raw.rating) ? (raw.rating as RatingFilterValue[]) : [],
    annotations: migrateLegacyPresence(raw.annotations)
  };
  const custom: Record<string, CustomFieldFilterValue> = {};
  if (isRecord(raw.custom)) {
    for (const [id, value] of Object.entries(raw.custom)) {
      const migrated = migrateCustomFieldFilterValue(value);
      if (migrated) custom[id] = migrated;
    }
  }
  const legacyDesc = migrateLegacyPresence(raw.description);
  if (legacyDesc && !custom.description) custom.description = legacyDesc;
  const legacyLink = migrateLegacyPresence(raw.link);
  if (legacyLink && !custom.link) custom.link = legacyLink;
  next.custom = custom;
  return next;
}

export function omitCustomFieldFromFilters(
  filters: GalleryAdvancedFilters,
  fieldId: string
): GalleryAdvancedFilters {
  if (!(fieldId in (filters.custom ?? {}))) return filters;
  const custom = { ...filters.custom };
  delete custom[fieldId];
  return { ...filters, custom };
}

/** Убирает пользовательские фильтры только для полей, которых уже нет в шаблоне. */
export function pruneCustomFiltersMissingFromTemplate(
  filters: GalleryAdvancedFilters,
  templateFieldIds: Iterable<string>
): GalleryAdvancedFilters {
  const ids = templateFieldIds instanceof Set ? templateFieldIds : new Set(templateFieldIds);
  let next = filters;
  for (const fieldId of Object.keys(next.custom ?? {})) {
    if (ids.has(fieldId)) continue;
    next = omitCustomFieldFromFilters(next, fieldId);
  }
  return next;
}

export function omitCustomFieldFromSort<T extends { field: string }>(
  sort: T,
  fieldId: string
): T | GallerySortState {
  if (parseCustomSortFieldId(sort.field) !== fieldId) return sort;
  return { ...DEFAULT_GALLERY_SORT };
}
