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

export type GalleryFilterStats = {
  weightBuckets: { maxMb: number; b1: number; b2: number; b3: number };
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

export type SavedFilterPreset = {
  id: string;
  name: string;
  payload: GalleryFilterPresetPayload;
  createdAt: string;
};

export type GalleryFeedScope = {
  libraryScope?: 'all' | 'untagged' | 'trash';
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
};

export const DEFAULT_GALLERY_SORT: GallerySortState = { field: 'addedAt', direction: 'desc' };

export const IMAGE_FILE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'WEBP', 'BMP'] as const;
export const VIDEO_FILE_EXTENSIONS = [
  'GIF',
  'MP4',
  'WEBM',
  'MOV',
  'AVI',
  'MKV',
  'FLV',
  'WMV',
  'MPEG',
  'MPG',
  'M2V',
  '3GP',
  'TS',
  'MTS',
  'M4V',
  'OGV'
] as const;

export const FILTER_CHIP_META: Record<
  GalleryFilterId,
  { label: string; iconClass: string }
> = {
  aspectRatio: { label: 'Соотношение сторон', iconClass: 'arc-icon-aspect-ratio' },
  fileType: { label: 'Тип файла', iconClass: 'arc-icon-file-type' },
  description: { label: 'Описание', iconClass: 'arc-icon-description' },
  link: { label: 'Ссылка', iconClass: 'arc-icon-link' },
  dateAdded: { label: 'Дата добавления', iconClass: 'arc-icon-calendar' },
  fileWeight: { label: 'Вес файла', iconClass: 'arc-icon-weight' },
  resolution: { label: 'Разрешение', iconClass: 'arc-icon-resolution' },
  duration: { label: 'Длительность', iconClass: 'arc-icon-duration' }
};

export const SORT_FIELD_LABELS: Record<GallerySortField, string> = {
  addedAt: 'Дата добавления',
  fileType: 'Тип файлов',
  fileWeight: 'Вес',
  resolution: 'Разрешение',
  duration: 'Длительность'
};

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

export function isFilterCategoryActive(filters: GalleryAdvancedFilters, id: GalleryFilterId): boolean {
  switch (id) {
    case 'aspectRatio':
      return filters.aspectRatios.length > 0;
    case 'fileType':
      return filters.fileExtensions.length > 0;
    case 'description':
      return filters.description != null;
    case 'link':
      return filters.link != null;
    case 'dateAdded':
      return filters.dateAdded.length > 0;
    case 'fileWeight':
      return filters.fileWeight.length > 0;
    case 'resolution':
      return filters.resolution.length > 0;
    case 'duration':
      return filters.duration.length > 0;
    default:
      return false;
  }
}

export function layoutToPresetItems(layout: GalleryFilterLayoutState): GalleryFilterLayoutItem[] {
  return layout.order.map((id) => ({ id, visible: layout.visible[id] }));
}

export function presetItemsToLayout(items: GalleryFilterLayoutItem[]): GalleryFilterLayoutState {
  const order = items.map((i) => i.id);
  const visible = Object.fromEntries(items.map((i) => [i.id, i.visible])) as Record<
    GalleryFilterId,
    boolean
  >;
  for (const id of GALLERY_FILTER_IDS) {
    if (!(id in visible)) visible[id] = true;
    if (!order.includes(id)) order.push(id);
  }
  return { order, visible };
}
