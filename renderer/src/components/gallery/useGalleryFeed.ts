import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { listCardsPage, type CardRecord } from '../../services/db';
import { ensureGalleryBootstrap } from './galleryBootstrap';
import { subscribeGalleryCardsChanged } from './galleryFeedCardsChanged';
import { notifyGalleryFeedSettledOnce } from './galleryFeedSettled';
import {
  buildGalleryQueryKey,
  GALLERY_MAX_CARDS_IN_MEMORY,
  GALLERY_PAGE_INITIAL,
  GALLERY_PAGE_MORE,
  isShuffleOnlyQueryChange,
  type GalleryFeedQuery
} from './galleryQuery';
import { useGalleryFilters } from './GalleryFilterContext';
import {
  clearGalleryMediaUrlCache,
  cancelGalleryMediaPreloads,
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from './galleryMediaCache';
import { isCardSectionMediaActive } from '../layout/cardSectionMedia';
import { clearMeasuredMasonryHeights } from '../masonry/masonryItemHeight';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize } from '../../layout/gridSizePreference';
import {
  getGalleryCacheHit,
  getGallerySnapshot,
  invalidateAllGallerySnapshots,
  setGallerySnapshot,
  type GalleryScopeSnapshot
} from './galleryScopeCache';

function sameCardOrder(a: readonly CardRecord[], b: readonly CardRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

type PrefetchedPage = {
  forOffset: number;
  cards: CardRecord[];
  srcMapPartial: Record<string, string>;
  hasMore: boolean;
  nextOffset: number;
};

function chunkSrcUrls(cards: readonly CardRecord[], srcMap: Record<string, string>): string[] {
  const urls: string[] = [];
  for (const card of cards) {
    const href = srcMap[card.id];
    if (href) urls.push(href);
  }
  return urls;
}

type FeedMediaTab = 'gallery' | 'collections' | 'moodboard';

function trimCardsWindow(
  cards: CardRecord[],
  srcMap: Record<string, string>
): { cards: CardRecord[]; srcMap: Record<string, string>; removedCount: number } {
  if (cards.length <= GALLERY_MAX_CARDS_IN_MEMORY) {
    return { cards, srcMap, removedCount: 0 };
  }
  const removedCount = cards.length - GALLERY_MAX_CARDS_IN_MEMORY;
  const trimmed = cards.slice(removedCount);
  const keepIds = new Set(trimmed.map((c) => c.id));
  const nextSrc: Record<string, string> = {};
  for (const id of keepIds) {
    if (srcMap[id]) nextSrc[id] = srcMap[id];
  }
  return { cards: trimmed, srcMap: nextSrc, removedCount };
}

function compensateScrollForTrim(removedCount: number): void {
  if (removedCount <= 0) return;
  const scrollAdjust = removedCount * 200;
  for (const selector of ['.arc-app-outlet', '.arc-collections-page-main__scroll']) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement && el.scrollTop > 0) {
      el.scrollTop = Math.max(0, el.scrollTop - scrollAdjust);
    }
  }
}

export function useGalleryFeed(
  query: GalleryFeedQuery,
  libraryReady: boolean,
  options?: { mediaSection?: FeedMediaTab; feedActive?: boolean }
) {
  const mediaTab = options?.mediaSection;
  const feedActive = options?.feedActive ?? true;
  const { setShuffleReloading } = useGalleryFilters();
  const queryKey = useMemo(() => buildGalleryQueryKey(query), [query]);
  const queryRef = useRef(query);
  queryRef.current = query;

  const initialSnapshot = useMemo(() => getGalleryCacheHit(queryKey), [queryKey]);

  const [cards, setCards] = useState<CardRecord[]>(() => initialSnapshot?.cards ?? []);
  const [srcMap, setSrcMap] = useState<Record<string, string>>(() => initialSnapshot?.srcMap ?? {});
  const [offset, setOffset] = useState(() => initialSnapshot?.offset ?? 0);
  const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(() => !initialSnapshot);
  const [feedSettled, setFeedSettled] = useState(() => Boolean(initialSnapshot));
  const [shuffleReloading, setShuffleReloadingLocal] = useState(false);

  const loadSeqRef = useRef(0);
  const prevQueryRef = useRef(query);
  const cardsRef = useRef(cards);
  const srcMapRef = useRef(srcMap);
  const offsetRef = useRef(offset);
  const hasMoreRef = useRef(hasMore);
  const prefetchRef = useRef<PrefetchedPage | null>(null);
  const prefetchInFlightRef = useRef(false);
  const staleAfterCardsChangedRef = useRef(false);
  const prevFeedActiveRef = useRef(feedActive);
  const feedActiveRef = useRef(feedActive);
  feedActiveRef.current = feedActive;
  const mediaTabRef = useRef(mediaTab);
  mediaTabRef.current = mediaTab;

  const preloadImages = useCallback((urls: readonly string[], limit: number) => {
    const tab = mediaTabRef.current;
    if (tab && !isCardSectionMediaActive(tab)) return;
    void preloadDecodedImages(urls, Math.min(limit, 12), tab);
  }, []);

  useEffect(() => {
    const becameActive = feedActive && !prevFeedActiveRef.current;
    prevFeedActiveRef.current = feedActive;
    if (becameActive && libraryReady) {
      staleAfterCardsChangedRef.current = false;
    }
  }, [feedActive, libraryReady]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    srcMapRef.current = srcMap;
  }, [srcMap]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const invalidatePrefetch = useCallback(() => {
    prefetchRef.current = null;
    prefetchInFlightRef.current = false;
  }, []);

  useEffect(() => {
    if (feedActive) return;
    cancelGalleryMediaPreloads();
    invalidatePrefetch();
    loadSeqRef.current += 1;
  }, [feedActive, invalidatePrefetch, queryKey]);

  const applySnapshot = useCallback((snapshot: GalleryScopeSnapshot) => {
    setCards(snapshot.cards);
    setSrcMap(snapshot.srcMap);
    setOffset(snapshot.offset);
    setHasMore(snapshot.hasMore);
    cardsRef.current = snapshot.cards;
    srcMapRef.current = snapshot.srcMap;
    offsetRef.current = snapshot.offset;
    hasMoreRef.current = snapshot.hasMore;
  }, []);

  const persistSnapshot = useCallback(
    (snapshot: GalleryScopeSnapshot) => {
      const trimmed = trimCardsWindow(snapshot.cards, snapshot.srcMap);
      if (trimmed.removedCount > 0) {
        compensateScrollForTrim(trimmed.removedCount);
      }
      const next = { ...snapshot, cards: trimmed.cards, srcMap: trimmed.srcMap, settled: true };
      setGallerySnapshot(queryKey, next);
      applySnapshot(next);
    },
    [applySnapshot, queryKey]
  );

  useLayoutEffect(() => {
    if (!libraryReady) {
      setFeedSettled(false);
      return;
    }
    const cached = getGalleryCacheHit(queryKey);
    if (cached) {
      applySnapshot(cached);
      setBooting(false);
      setFeedSettled(true);
      return;
    }
    setFeedSettled(false);
  }, [applySnapshot, libraryReady, queryKey]);

  const prefetchNextPage = useCallback(async (startOffset: number, seq: number) => {
    if (!feedActiveRef.current) return;
    if (seq !== loadSeqRef.current) return;
    const q = queryRef.current;
    if (!hasMoreRef.current || prefetchInFlightRef.current) return;
    if (prefetchRef.current?.forOffset === startOffset) return;

    prefetchInFlightRef.current = true;
    try {
      const take = GALLERY_PAGE_MORE;
      if (!feedActiveRef.current || seq !== loadSeqRef.current) return;
      const chunk = await listCardsPage({
        offset: startOffset,
        limit: take,
        libraryScope: q.libraryScope,
        selectedTagIds: q.selectedTagIds,
        cardIdExact: q.cardIdExact,
        collectionId: q.collectionId,
        moodboardCardIds: q.moodboardCardIds,
        advancedFilters: q.advancedFilters,
        sort: q.sort
      });

      if (!feedActiveRef.current || seq !== loadSeqRef.current || chunk.length === 0) return;

      const gridSize = readGridSize();
      const peek = peekCardsSrcMap(chunk, gridSize, mediaTabRef.current);
      const resolved = await mergeCardsSrcMap(chunk, peek, gridSize, mediaTabRef.current);
      if (!feedActiveRef.current || seq !== loadSeqRef.current) return;

      const hasMoreNext = chunk.length === take;
      prefetchRef.current = {
        forOffset: startOffset,
        cards: chunk,
        srcMapPartial: resolved,
        hasMore: hasMoreNext,
        nextOffset: startOffset + chunk.length
      };

      void preloadImages(chunkSrcUrls(chunk, resolved), take);
    } finally {
      prefetchInFlightRef.current = false;
    }
  }, [preloadImages]);

  const fetchPage = useCallback(
    async (start: number, append: boolean, seq: number) => {
      if (!feedActiveRef.current) {
        return;
      }
      const q = queryRef.current;
      const take = start === 0 ? GALLERY_PAGE_INITIAL : GALLERY_PAGE_MORE;
      const chunk = await listCardsPage({
        offset: start,
        limit: take,
        libraryScope: q.libraryScope,
        selectedTagIds: q.selectedTagIds,
        cardIdExact: q.cardIdExact,
        collectionId: q.collectionId,
        moodboardCardIds: q.moodboardCardIds,
        advancedFilters: q.advancedFilters,
        sort: q.sort
      });

      if (!feedActiveRef.current || seq !== loadSeqRef.current) {
        return;
      }

      const gridSize = readGridSize();
      const hasMoreNext = chunk.length === take;
      const nextOffset = start + chunk.length;
      const prevCards = cardsRef.current;
      const prevSrcMap = srcMapRef.current;
      const nextCards = append ? [...prevCards, ...chunk] : chunk;

      if (!append) {
        const cached = getGallerySnapshot(queryKey);
        if (cached && sameCardOrder(cached.cards, chunk)) {
          const mergedSrc = await mergeCardsSrcMap(
            chunk,
            { ...cached.srcMap, ...peekCardsSrcMap(chunk, gridSize, mediaTabRef.current) },
            gridSize,
            mediaTabRef.current
          );
          if (seq !== loadSeqRef.current) {
            return;
          }
          persistSnapshot({
            cards: chunk,
            srcMap: mergedSrc,
            offset: nextOffset,
            hasMore: hasMoreNext
          });
          preloadImages(chunkSrcUrls(chunk, mergedSrc), chunk.length);
          if (hasMoreNext) {
            void prefetchNextPage(nextOffset, seq);
          } else {
            invalidatePrefetch();
          }
          return;
        }
      }

      const peek = peekCardsSrcMap(nextCards, gridSize, mediaTabRef.current);
      const baseSrc = append ? { ...prevSrcMap, ...peek } : peek;
      const resolved = await mergeCardsSrcMap(append ? chunk : nextCards, baseSrc, gridSize, mediaTabRef.current);
      if (seq !== loadSeqRef.current) {
        return;
      }

      persistSnapshot({
        cards: nextCards,
        srcMap: resolved,
        offset: nextOffset,
        hasMore: hasMoreNext
      });

      const decodeChunk = append ? chunk : nextCards;
      preloadImages(chunkSrcUrls(decodeChunk, resolved), decodeChunk.length);

      if (hasMoreNext && feedActiveRef.current) {
        void prefetchNextPage(nextOffset, seq);
      } else {
        invalidatePrefetch();
      }
    },
    [invalidatePrefetch, persistSnapshot, prefetchNextPage, preloadImages, queryKey]
  );

  const reloadFromStart = useCallback(
    async (options?: { showBoot?: boolean; clearDisplay?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (options?.clearDisplay) {
        setCards([]);
        setSrcMap({});
        setOffset(0);
        setHasMore(true);
        cardsRef.current = [];
        srcMapRef.current = {};
        offsetRef.current = 0;
        hasMoreRef.current = true;
        invalidatePrefetch();
      }
      if (options?.showBoot) setBooting(true);
      setLoading(true);
      try {
        await fetchPage(0, false, seq);
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setBooting(false);
        }
      }
    },
    [fetchPage, invalidatePrefetch]
  );

  useEffect(() => {
    invalidatePrefetch();
  }, [invalidatePrefetch, queryKey]);

  useLayoutEffect(() => {
    const cached = getGalleryCacheHit(queryKey);
    if (cached) {
      applySnapshot(cached);
      setBooting(false);
      setFeedSettled(true);
      return;
    }

    if (!libraryReady) {
      setBooting(true);
      return;
    }

    if (!feedActive) {
      setBooting(true);
      return;
    }

    const prevQuery = prevQueryRef.current;
    prevQueryRef.current = queryRef.current;
    const shuffleOnly =
      cardsRef.current.length > 0 && isShuffleOnlyQueryChange(prevQuery, queryRef.current);

    if (shuffleOnly) {
      setShuffleReloadingLocal(true);
      setShuffleReloading(true);
      const seq = ++loadSeqRef.current;
      setLoading(true);
      void (async () => {
        try {
          await fetchPage(0, false, seq);
        } finally {
          if (seq === loadSeqRef.current) {
            setLoading(false);
            setShuffleReloadingLocal(false);
            setShuffleReloading(false);
          }
        }
      })();
      return;
    }

    const seq = ++loadSeqRef.current;
    setBooting(true);
    setLoading(true);
    void (async () => {
      try {
        await ensureGalleryBootstrap(queryRef.current, mediaTab);
        if (seq !== loadSeqRef.current) return;
        const warmed = getGalleryCacheHit(queryKey);
        if (warmed) {
          applySnapshot(warmed);
          setFeedSettled(true);
          if (feedActive && mediaTab === 'gallery') notifyGalleryFeedSettledOnce();
          return;
        }
        await fetchPage(0, false, seq);
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setBooting(false);
          setFeedSettled(true);
          if (feedActive && mediaTab === 'gallery') notifyGalleryFeedSettledOnce();
        }
      }
    })();
  }, [applySnapshot, feedActive, fetchPage, libraryReady, mediaTab, queryKey, setShuffleReloading]);

  useEffect(() => {
    if (!feedActive || !libraryReady || !staleAfterCardsChangedRef.current) return;
    if (loading || booting) {
      staleAfterCardsChangedRef.current = false;
      return;
    }
    staleAfterCardsChangedRef.current = false;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    void (async () => {
      try {
        await fetchPage(0, false, seq);
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    })();
  }, [booting, feedActive, fetchPage, libraryReady, loading, queryKey]);

  useEffect(() => {
    const onCardsChangedFlush = () => {
      invalidatePrefetch();
      if (!feedActive || !libraryReady) {
        staleAfterCardsChangedRef.current = true;
        return;
      }
      const seq = ++loadSeqRef.current;
      setLoading(true);
      void (async () => {
        try {
          await fetchPage(0, false, seq);
        } finally {
          if (seq === loadSeqRef.current) setLoading(false);
        }
      })();
    };
    const onLibraryChanged = () => {
      if (!feedActive) return;
      clearGalleryMediaUrlCache();
      clearMeasuredMasonryHeights();
      invalidatePrefetch();
      invalidateAllGallerySnapshots();
      void reloadFromStart({ showBoot: true, clearDisplay: true });
    };
    const unsubCards = subscribeGalleryCardsChanged(onCardsChangedFlush);
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => {
      unsubCards();
      window.removeEventListener('arc:library-changed', onLibraryChanged);
    };
  }, [feedActive, fetchPage, invalidatePrefetch, libraryReady, queryKey, reloadFromStart]);

  useEffect(() => {
    const onGridSizeChanged = () => {
      if (!feedActive || !libraryReady) return;
      clearGalleryMediaUrlCache();
      clearMeasuredMasonryHeights();
      invalidatePrefetch();
      invalidateAllGallerySnapshots();
      const seq = ++loadSeqRef.current;
      setLoading(true);
      void (async () => {
        try {
          await fetchPage(0, false, seq);
        } finally {
          if (seq === loadSeqRef.current) setLoading(false);
        }
      })();
    };
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
    return () => window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
  }, [feedActive, fetchPage, invalidatePrefetch, libraryReady]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const seq = loadSeqRef.current;
    const currentOffset = offsetRef.current;
    const prefetched = prefetchRef.current;

    setLoading(true);
    try {
      if (prefetched && prefetched.forOffset === currentOffset) {
        prefetchRef.current = null;
        const nextCards = [...cardsRef.current, ...prefetched.cards];
        const nextSrc = { ...srcMapRef.current, ...prefetched.srcMapPartial };
        persistSnapshot({
          cards: nextCards,
          srcMap: nextSrc,
          offset: prefetched.nextOffset,
          hasMore: prefetched.hasMore
        });
        preloadImages(
          chunkSrcUrls(prefetched.cards, prefetched.srcMapPartial),
          prefetched.cards.length
        );
        if (prefetched.hasMore) {
          void prefetchNextPage(prefetched.nextOffset, seq);
        }
        return;
      }

      await fetchPage(currentOffset, true, seq);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [fetchPage, hasMore, loading, persistSnapshot, prefetchNextPage, preloadImages]);

  return {
    cards,
    srcMap,
    offset,
    hasMore,
    loading,
    booting,
    feedSettled,
    shuffleReloading,
    loadMore,
    reloadFromStart
  };
}
