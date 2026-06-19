/** Shared gallery filter types — single source for renderer and main process. */

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

export const GALLERY_ORDERABLE_SORT_FIELDS = [
  'addedAt',
  'fileType',
  'fileWeight',
  'resolution',
  'duration'
] as const;

export type GalleryOrderableSortField = (typeof GALLERY_ORDERABLE_SORT_FIELDS)[number];
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

export function isGalleryShuffleSort(sort: GallerySortState): boolean {
  return sort.field === 'shuffle';
}
