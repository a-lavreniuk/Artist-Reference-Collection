import { useMemo } from 'react';
import {
  parseSearchAiQuery,
  parseSearchColorHex,
  parseSearchColorTolerance,
  parseSearchSimilarCrop,
  parseSearchSimilarRef
} from '../../search/searchUrl';
import type { GallerySortState } from './galleryFilterTypes';
import type { GalleryFeedQuery } from './galleryQuery';
import { useAiGalleryFeed } from './useAiGalleryFeed';
import { useColorGalleryFeed } from './useColorGalleryFeed';
import { useSimilarGalleryFeed } from './useSimilarGalleryFeed';

export type UseGalleryRemoteSearchFeedParams = {
  searchParams: URLSearchParams;
  feedQuery: GalleryFeedQuery;
  libraryReady: boolean;
  sort: GallerySortState;
  /** Client-side scope filter; omit when `feedQuery.collectionId` / `moodboardCardIds` scope on server. */
  scopeCardIds?: ReadonlySet<string> | null;
};

export function useGalleryRemoteSearchFeed(params: UseGalleryRemoteSearchFeedParams) {
  const { searchParams, feedQuery, libraryReady, sort, scopeCardIds } = params;

  const aiQuery = useMemo(() => parseSearchAiQuery(searchParams), [searchParams]);
  const colorHex = useMemo(() => parseSearchColorHex(searchParams), [searchParams]);
  const colorTolerance = useMemo(() => parseSearchColorTolerance(searchParams), [searchParams]);
  const similarRef = useMemo(() => parseSearchSimilarRef(searchParams), [searchParams]);
  const similarCrop = useMemo(() => parseSearchSimilarCrop(searchParams), [searchParams]);

  const isAiSearch = Boolean(aiQuery);
  const isColorSearch = Boolean(colorHex);
  const isSimilarSearch = Boolean(similarRef);
  const isRemoteSearchFeed = isAiSearch || isColorSearch || isSimilarSearch;

  const serverScoped =
    Boolean(feedQuery.collectionId) || Boolean(feedQuery.moodboardCardIds?.length);
  const clientScope = serverScoped ? null : scopeCardIds ?? null;

  const aiFeed = useAiGalleryFeed(aiQuery, libraryReady && isAiSearch, sort, {
    collectionId: feedQuery.collectionId ?? null,
    moodboardCardIds: feedQuery.moodboardCardIds ?? null,
    scopeCardIds: clientScope
  });
  const colorFeed = useColorGalleryFeed(
    colorHex,
    colorTolerance,
    feedQuery,
    libraryReady && isColorSearch,
    { scopeCardIds: clientScope }
  );
  const similarFeed = useSimilarGalleryFeed(
    similarRef,
    similarCrop,
    feedQuery,
    libraryReady && isSimilarSearch,
    { scopeCardIds: clientScope }
  );

  const activeFeed = isSimilarSearch ? similarFeed : isColorSearch ? colorFeed : aiFeed;

  return {
    isAiSearch,
    isColorSearch,
    isSimilarSearch,
    isRemoteSearchFeed,
    displayCards: activeFeed.cards,
    displaySrcMap: activeFeed.srcMap,
    displayLoading: activeFeed.loading,
    displayBooting: activeFeed.booting ?? false,
    displayHasMore: activeFeed.hasMore ?? false,
    displayLoadMore: activeFeed.loadMore ?? (() => {}),
    feedError: activeFeed.error ?? null,
    reloadRemoteFeed: activeFeed.reloadFromStart
  };
}
