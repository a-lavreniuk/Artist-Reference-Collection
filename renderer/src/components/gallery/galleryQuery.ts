import type { LibraryScope } from '../../search/libraryScopeUrl';
import type { GalleryAdvancedFilters, GallerySortState } from './galleryFilterTypes';
import { DEFAULT_GALLERY_SORT, emptyGalleryAdvancedFilters } from './galleryFilterTypes';

export type GalleryFeedQuery = {
  libraryScope: LibraryScope;
  selectedTagIds: string[];
  cardIdExact: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters: GalleryAdvancedFilters;
  sort: GallerySortState;
};

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function buildGalleryQueryKey(query: GalleryFeedQuery): string {
  const tags = [...query.selectedTagIds].sort().join('\u0001');
  const mb = [...(query.moodboardCardIds ?? [])].sort().join('\u0001');
  const sortKey =
    query.sort.field === 'shuffle'
      ? `shuffle:${query.sort.shuffleSeed ?? 0}`
      : `${query.sort.field}:${query.sort.direction}`;
  return [
    query.libraryScope,
    query.collectionId ?? '',
    mb,
    tags,
    query.cardIdExact ?? '',
    stableJson(query.advancedFilters),
    sortKey
  ].join('|');
}

export const GALLERY_PAGE_INITIAL = 50;
export const GALLERY_PAGE_MORE = 35;

export const GALLERY_WARMUP_SCOPES: readonly LibraryScope[] = ['all', 'untagged', 'trash'];

export function defaultGalleryFeedQuery(scope: LibraryScope = 'all'): GalleryFeedQuery {
  return {
    libraryScope: scope,
    selectedTagIds: [],
    cardIdExact: null,
    advancedFilters: emptyGalleryAdvancedFilters(),
    sort: DEFAULT_GALLERY_SORT
  };
}
