import { useCallback, useMemo } from 'react';
import type { CardRecord } from '../../services/db';
import type { GalleryFeedQuery } from './galleryQuery';
import { usePaginatedRemoteFeed } from './usePaginatedRemoteFeed';

export type ColorGalleryFeedOptions = {
  scopeCardIds?: ReadonlySet<string> | null;
};

export function useColorGalleryFeed(
  colorHex: string | null,
  tolerance: number,
  feedQuery: GalleryFeedQuery,
  libraryReady: boolean,
  options?: ColorGalleryFeedOptions
) {
  const hex = useMemo(() => colorHex?.trim().toUpperCase() ?? '', [colorHex]);
  const scopeCardIds = options?.scopeCardIds ?? null;

  const requestBase = useMemo(
    () => ({
      hex,
      accuracy: tolerance,
      libraryScope: feedQuery.libraryScope,
      selectedTagIds: feedQuery.selectedTagIds,
      cardIdExact: feedQuery.cardIdExact,
      collectionId: feedQuery.collectionId ?? null,
      moodboardCardIds: feedQuery.moodboardCardIds ?? null,
      advancedFilters: feedQuery.advancedFilters,
      sort: feedQuery.sort,
      scopeCardIds: scopeCardIds ? [...scopeCardIds] : undefined
    }),
    [hex, tolerance, feedQuery, scopeCardIds]
  );

  const resetKey = useMemo(() => JSON.stringify(requestBase), [requestBase]);

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const arc = window.arc;
      if (!arc?.colorSearchCards || !hex) return [];
      const raw = await arc.colorSearchCards({ ...requestBase, offset, limit });
      return Array.isArray(raw) ? (raw as CardRecord[]) : [];
    },
    [hex, requestBase]
  );

  const feed = usePaginatedRemoteFeed({
    enabled: libraryReady && Boolean(hex),
    fetchPage,
    resetKey
  });

  return feed;
}
