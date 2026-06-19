import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARC_CARDS_CHANGED_EVENT, listCardsPage, type CardRecord } from '../../services/db';
import { ensureGalleryBootstrap, scheduleGalleryWarmup } from './galleryBootstrap';
import {
  buildGalleryQueryKey,
  defaultGalleryFeedQuery,
  GALLERY_MAX_CARDS_IN_MEMORY,
  GALLERY_PAGE_INITIAL,
  GALLERY_PAGE_MORE,
  isShuffleOnlyQueryChange,
  type GalleryFeedQuery
} from './galleryQuery';
import { useGalleryFilters } from './GalleryFilterContext';
import {
  clearGalleryMediaUrlCache,
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from './galleryMediaCache';
import { clearMeasuredMasonryHeights } from '../masonry/masonryItemHeight';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize } from '../../layout/gridSizePreference';
import {
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

export function useGalleryFeed(query: GalleryFeedQuery, libraryReady: boolean) {
  const { setShuffleReloading } = useGalleryFilters();
  const queryKey = useMemo(() => buildGalleryQueryKey(query), [query]);
  const initialSnapshot = useMemo(() => getGallerySnapshot(queryKey), [queryKey]);

  const [cards, setCards] = useState<CardRecord[]>(() => initialSnapshot?.cards ?? []);
  const [srcMap, setSrcMap] = useState<Record<string, string>>(() => initialSnapshot?.srcMap ?? {});
  const [offset, setOffset] = useState(() => initialSnapshot?.offset ?? 0);
  const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(() => libraryReady && !initialSnapshot);
  const [shuffleReloading, setShuffleReloadingLocal] = useState(false);

  const loadSeqRef = useRef(0);
  const prevQueryRef = useRef(query);
  const cardsRef = useRef(cards);
  const srcMapRef = useRef(srcMap);
  const offsetRef = useRef(offset);
  const hasMoreRef = useRef(hasMore);
  const prefetchRef = useRef<PrefetchedPage | null>(null);
  const prefetchInFlightRef = useRef(false);

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

  const applySnapshot = useCallback((snapshot: GalleryScopeSnapshot) => {
    setCards(snapshot.cards);
    setSrcMap(snapshot.srcMap);
    setOffset(snapshot.offset);
    setHasMore(snapshot.hasMore);
  }, []);

  const persistSnapshot = useCallback(
    (snapshot: GalleryScopeSnapshot) => {
      const trimmed = trimCardsWindow(snapshot.cards, snapshot.srcMap);
      if (trimmed.removedCount > 0) {
        compensateScrollForTrim(trimmed.removedCount);
      }
      const next = { ...snapshot, cards: trimmed.cards, srcMap: trimmed.srcMap };
      setGallerySnapshot(queryKey, next);
      applySnapshot(next);
      offsetRef.current = next.offset;
      hasMoreRef.current = next.hasMore;
    },
    [applySnapshot, queryKey]
  );

  const prefetchNextPage = useCallback(
    async (startOffset: number, seq: number) => {
      if (!hasMoreRef.current || prefetchInFlightRef.current) return;
      if (prefetchRef.current?.forOffset === startOffset) return;

      prefetchInFlightRef.current = true;
      try {
        const take = GALLERY_PAGE_MORE;
        const chunk = await listCardsPage({
          offset: startOffset,
          limit: take,
          libraryScope: query.libraryScope,
          selectedTagIds: query.selectedTagIds,
          cardIdExact: query.cardIdExact,
          collectionId: query.collectionId,
          moodboardCardIds: query.moodboardCardIds,
          advancedFilters: query.advancedFilters,
          sort: query.sort
        });

        if (seq !== loadSeqRef.current || chunk.length === 0) return;

        const gridSize = readGridSize();
        const peek = peekCardsSrcMap(chunk, gridSize);
        const resolved = await mergeCardsSrcMap(chunk, peek, gridSize);
        if (seq !== loadSeqRef.current) return;

        const hasMoreNext = chunk.length === take;
        prefetchRef.current = {
          forOffset: startOffset,
          cards: chunk,
          srcMapPartial: resolved,
          hasMore: hasMoreNext,
          nextOffset: startOffset + chunk.length
        };

        void preloadDecodedImages(chunkSrcUrls(chunk, resolved), take);
      } finally {
        prefetchInFlightRef.current = false;
      }
    },
    [query]
  );

  const fetchPage = useCallback(
    async (start: number, append: boolean, seq: number, options?: { preloadDecode?: boolean }) => {
      const take = start === 0 ? GALLERY_PAGE_INITIAL : GALLERY_PAGE_MORE;
      const chunk = await listCardsPage({
        offset: start,
        limit: take,
        libraryScope: query.libraryScope,
        selectedTagIds: query.selectedTagIds,
        cardIdExact: query.cardIdExact,
        collectionId: query.collectionId,
        moodboardCardIds: query.moodboardCardIds,
        advancedFilters: query.advancedFilters,
        sort: query.sort
      });

      if (seq !== loadSeqRef.current) return;

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
            { ...cached.srcMap, ...peekCardsSrcMap(chunk, gridSize) },
            gridSize
          );
          if (seq !== loadSeqRef.current) return;
          persistSnapshot({
            cards: chunk,
            srcMap: mergedSrc,
            offset: nextOffset,
            hasMore: hasMoreNext
          });
          void preloadDecodedImages(chunkSrcUrls(chunk, mergedSrc), chunk.length);
          if (hasMoreNext) {
            void prefetchNextPage(nextOffset, seq);
          } else {
            invalidatePrefetch();
          }
          if (options?.preloadDecode) {
            await preloadDecodedImages(Object.values(mergedSrc));
          }
          return;
        }
      }

      const peek = peekCardsSrcMap(nextCards, gridSize);
      const baseSrc = append ? { ...prevSrcMap, ...peek } : peek;
      const resolved = await mergeCardsSrcMap(append ? chunk : nextCards, baseSrc, gridSize);
      if (seq !== loadSeqRef.current) return;

      persistSnapshot({
        cards: nextCards,
        srcMap: resolved,
        offset: nextOffset,
        hasMore: hasMoreNext
      });

      const decodeChunk = append ? chunk : nextCards;
      void preloadDecodedImages(chunkSrcUrls(decodeChunk, resolved), decodeChunk.length);

      if (hasMoreNext) {
        void prefetchNextPage(nextOffset, seq);
      } else {
        invalidatePrefetch();
      }

      if (options?.preloadDecode) {
        await preloadDecodedImages(Object.values(resolved));
      }
    },
    [invalidatePrefetch, persistSnapshot, prefetchNextPage, query, queryKey]
  );

  const reloadFromStart = useCallback(
    async (options?: { preloadDecode?: boolean; showBoot?: boolean; clearDisplay?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (options?.clearDisplay) {
        setCards([]);
        setSrcMap({});
        setOffset(0);
        setHasMore(true);
        invalidatePrefetch();
      }
      if (options?.showBoot) setBooting(true);
      setLoading(true);
      try {
        await fetchPage(0, false, seq, options);
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

  useEffect(() => {
    if (!libraryReady) {
      setBooting(false);
      return;
    }

    const prevQuery = prevQueryRef.current;
    prevQueryRef.current = query;
    const shuffleOnly =
      cardsRef.current.length > 0 && isShuffleOnlyQueryChange(prevQuery, query);

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

    const cached = getGallerySnapshot(queryKey);
    if (cached) {
      applySnapshot(cached);
      setBooting(false);
      const seq = ++loadSeqRef.current;
      void fetchPage(0, false, seq);
      return;
    }

    const seq = ++loadSeqRef.current;
    setBooting(true);
    setLoading(true);
    void (async () => {
      try {
        await ensureGalleryBootstrap(defaultGalleryFeedQuery());
        const warmed = getGallerySnapshot(queryKey);
        if (warmed && seq === loadSeqRef.current) {
          applySnapshot(warmed);
          setBooting(false);
        }
        await fetchPage(0, false, seq, { preloadDecode: !warmed });
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setBooting(false);
        }
      }
    })();
  }, [applySnapshot, fetchPage, libraryReady, query, queryKey, setShuffleReloading]);

  useEffect(() => {
    const onCardsChanged = () => {
      invalidatePrefetch();
      invalidateAllGallerySnapshots();
      const seq = ++loadSeqRef.current;
      setLoading(true);
      void (async () => {
        try {
          await fetchPage(0, false, seq);
          scheduleGalleryWarmup();
        } finally {
          if (seq === loadSeqRef.current) setLoading(false);
        }
      })();
    };
    const onLibraryChanged = () => {
      clearGalleryMediaUrlCache();
      clearMeasuredMasonryHeights();
      invalidatePrefetch();
      invalidateAllGallerySnapshots();
      void reloadFromStart({ preloadDecode: true, showBoot: true, clearDisplay: true });
    };
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
      window.removeEventListener('arc:library-changed', onLibraryChanged);
    };
  }, [fetchPage, invalidatePrefetch, reloadFromStart]);

  useEffect(() => {
    const onGridSizeChanged = () => {
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
  }, [fetchPage, invalidatePrefetch]);

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
        void preloadDecodedImages(
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
  }, [fetchPage, hasMore, loading, persistSnapshot, prefetchNextPage]);

  return {
    cards,
    srcMap,
    offset,
    hasMore,
    loading,
    booting,
    shuffleReloading,
    loadMore,
    reloadFromStart
  };
}
