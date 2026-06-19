export {
  GALLERY_FILTER_IDS,
  GALLERY_ORDERABLE_SORT_FIELDS,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  defaultGalleryFilterLayout,
  countActiveFilterCategories,
  isGalleryShuffleSort
} from '@arc-main-shared/galleryFilterCore';

export type {
  GalleryFilterId,
  GalleryOrderableSortField,
  GallerySortField,
  GallerySortDirection,
  GallerySortState,
  AspectRatioFilterValue,
  DescriptionFilterValue,
  LinkFilterValue,
  DateAddedPreset,
  DateAddedFilterValue,
  FileWeightPreset,
  FileWeightFilterValue,
  ResolutionPreset,
  ResolutionFilterValue,
  DurationPreset,
  DurationFilterValue,
  GalleryAdvancedFilters,
  GalleryFilterLayoutItem,
  GalleryFilterPresetPayload,
  GalleryFilterLayoutState
} from '@arc-main-shared/galleryFilterCore';

export type WeightSegment = {
  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';
  label: string;
  minMb: number;
  maxMb: number;
};

export type DurationSegment = {
  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';
  label: string;
  minMs: number;
  maxMs: number;
};

export type FileWeightMeta = {
  minMb: number;
  maxMb: number;
  segments: WeightSegment[];
};

export type DurationMeta = {
  minSec: number;
  maxSec: number;
  maxDurationMs: number;
  segments: DurationSegment[];
};

export type ResolutionSegment = {
  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';
  label: string;
  minPx: number;
  maxPx: number;
  openEnd?: boolean;
};

export type ResolutionMeta = {
  minPx: number;
  maxPx: number;
  segments: ResolutionSegment[];
};

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

const LEGACY_DURATION_PRESETS: Record<string, DurationPreset> = {
  up5: 'bucket1',
  '5to15': 'bucket2',
  '15to30': 'bucket3',
  '30to60': 'bucket4',
  over60: 'bucket4'
};

function migrateDurationFilterValue(d: DurationFilterValue): DurationFilterValue {
  if (d.preset !== 'custom') {
    const legacy = LEGACY_DURATION_PRESETS[d.preset as string];
    if (legacy) return { preset: legacy };
    return d;
  }
  const legacy = d as DurationFilterValue & { minMinutes?: number; maxMinutes?: number };
  if (typeof legacy.minSeconds === 'number' && typeof legacy.maxSeconds === 'number') {
    return { preset: 'custom', minSeconds: legacy.minSeconds, maxSeconds: legacy.maxSeconds };
  }
  if (typeof legacy.minMinutes === 'number' && typeof legacy.maxMinutes === 'number') {
    return {
      preset: 'custom',
      minSeconds: Math.round(legacy.minMinutes * 60),
      maxSeconds: Math.round(legacy.maxMinutes * 60)
    };
  }
  return d;
}

const LEGACY_RESOLUTION_PRESETS = new Set(['720p', '1080p', '4k']);

function migrateResolutionFilterValue(r: ResolutionFilterValue): ResolutionFilterValue | null {
  if (r.preset === 'custom') return r;
  if (LEGACY_RESOLUTION_PRESETS.has(r.preset as string)) return null;
  if (
    r.preset === 'bucket1' ||
    r.preset === 'bucket2' ||
    r.preset === 'bucket3' ||
    r.preset === 'bucket4'
  ) {
    return r;
  }
  return null;
}

export function migrateGalleryAdvancedFilters(filters: GalleryAdvancedFilters): GalleryAdvancedFilters {
  return {
    ...filters,
    duration: filters.duration.map(migrateDurationFilterValue),
    resolution: filters.resolution
      .map(migrateResolutionFilterValue)
      .filter((r): r is ResolutionFilterValue => r !== null)
  };
}

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

export const SORT_FIELD_LABELS: Record<GalleryOrderableSortField, string> = {
  addedAt: 'Дата добавления',
  fileType: 'Тип файлов',
  fileWeight: 'Вес',
  resolution: 'Разрешение',
  duration: 'Длительность'
};

/** Подписи направления сортировки для каждого критерия (вариант A). */
export const SORT_DIRECTION_OPTIONS: Record<
  GalleryOrderableSortField,
  { primary: GallerySortDirection; primaryLabel: string; secondary: GallerySortDirection; secondaryLabel: string }
> = {
  addedAt: {
    primary: 'desc',
    primaryLabel: 'Сначала новые',
    secondary: 'asc',
    secondaryLabel: 'Сначала старые'
  },
  fileType: {
    primary: 'asc',
    primaryLabel: 'Сначала изображения',
    secondary: 'desc',
    secondaryLabel: 'Сначала видео'
  },
  fileWeight: {
    primary: 'desc',
    primaryLabel: 'Сначала тяжёлые',
    secondary: 'asc',
    secondaryLabel: 'Сначала лёгкие'
  },
  resolution: {
    primary: 'desc',
    primaryLabel: 'Сначала большие',
    secondary: 'asc',
    secondaryLabel: 'Сначала маленькие'
  },
  duration: {
    primary: 'desc',
    primaryLabel: 'Сначала длинные',
    secondary: 'asc',
    secondaryLabel: 'Сначала короткие'
  }
};

export function defaultSortDirectionForField(field: GalleryOrderableSortField): GallerySortDirection {
  return SORT_DIRECTION_OPTIONS[field].primary;
}

export function createGalleryShuffleSort(seed?: number): GallerySortState {
  return { field: 'shuffle', direction: 'desc', shuffleSeed: seed };
}

export function isFilterCategoryActive(filters: GalleryAdvancedFilters, id: GalleryFilterId): boolean {
  return countFilterCategorySelections(filters, id) > 0;
}

export function countFilterCategorySelections(
  filters: GalleryAdvancedFilters,
  id: GalleryFilterId
): number {
  switch (id) {
    case 'aspectRatio':
      return filters.aspectRatios.length;
    case 'fileType':
      return filters.fileExtensions.length;
    case 'description': {
      if (!filters.description) return 0;
      let n = 1;
      if (filters.description.keywords?.trim()) n++;
      return n;
    }
    case 'link': {
      if (!filters.link) return 0;
      let n = 1;
      if (filters.link.keywords?.trim()) n++;
      return n;
    }
    case 'dateAdded':
      return filters.dateAdded.length;
    case 'fileWeight':
      return filters.fileWeight.length;
    case 'resolution':
      return filters.resolution.length;
    case 'duration':
      return filters.duration.length;
    default:
      return 0;
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
