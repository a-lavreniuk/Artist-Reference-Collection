import type { LibraryScope } from '../../search/libraryScopeUrl';

export type GalleryFeedFilter = 'all' | 'images' | 'videos';

export type GalleryFeedQuery = {
  filter: GalleryFeedFilter;
  libraryScope: LibraryScope;
  selectedTagIds: string[];
  cardIdExact: string | null;
};

export function buildGalleryQueryKey(query: GalleryFeedQuery): string {
  const tags = [...query.selectedTagIds].sort().join('\u0001');
  return `${query.libraryScope}|${query.filter}|${tags}|${query.cardIdExact ?? ''}`;
}

export const GALLERY_PAGE_INITIAL = 50;
export const GALLERY_PAGE_MORE = 25;

export const GALLERY_WARMUP_SCOPES: readonly LibraryScope[] = ['all', 'untagged', 'trash'];

export function defaultGalleryFeedQuery(scope: LibraryScope = 'all'): GalleryFeedQuery {
  return {
    filter: 'all',
    libraryScope: scope,
    selectedTagIds: [],
    cardIdExact: null
  };
}
