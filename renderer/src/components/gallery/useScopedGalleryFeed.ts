import type { GallerySortState } from './galleryFilterTypes';
import type { GalleryFeedQuery } from './galleryQuery';
import { useGalleryFeed } from './useGalleryFeed';
import { useGalleryRemoteSearchFeed } from './useGalleryRemoteSearchFeed';

type Params = {
  feedQuery: GalleryFeedQuery;
  searchParams: URLSearchParams;
  sort: GallerySortState;
  libraryReady: boolean;
};

/** Локальная лента (useGalleryFeed) + remote search feeds в одном контракте. */
export function useScopedGalleryFeed(params: Params) {
  const { feedQuery, searchParams, sort, libraryReady } = params;

  const remote = useGalleryRemoteSearchFeed({
    searchParams,
    feedQuery,
    libraryReady,
    sort
  });

  const local = useGalleryFeed(feedQuery, libraryReady && !remote.isRemoteSearchFeed);

  if (remote.isRemoteSearchFeed) {
    return {
      isRemoteSearchFeed: true as const,
      isAiSearch: remote.isAiSearch,
      feedError: remote.feedError,
      cards: remote.displayCards,
      srcMap: remote.displaySrcMap,
      hasMore: remote.displayHasMore,
      loading: remote.displayLoading,
      booting: remote.displayBooting,
      shuffleReloading: false,
      loadMore: remote.displayLoadMore,
      reloadFromStart: remote.reloadRemoteFeed
    };
  }

  return {
    isRemoteSearchFeed: false as const,
    isAiSearch: false,
    feedError: null as string | null,
    cards: local.cards,
    srcMap: local.srcMap,
    hasMore: local.hasMore,
    loading: local.loading,
    booting: local.booting,
    shuffleReloading: local.shuffleReloading,
    loadMore: local.loadMore,
    reloadFromStart: local.reloadFromStart
  };
}
