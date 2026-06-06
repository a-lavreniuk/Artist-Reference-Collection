import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARC_CARDS_CHANGED_EVENT, listCardsPage, type CardRecord } from '../../services/db';
import { ensureGalleryBootstrap, scheduleGalleryWarmup } from './galleryBootstrap';
import {
  buildGalleryQueryKey,
  defaultGalleryFeedQuery,
  GALLERY_PAGE_INITIAL,
  GALLERY_PAGE_MORE,
  type GalleryFeedQuery
} from './galleryQuery';
import {
  clearGalleryMediaUrlCache,
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from './galleryMediaCache';
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

export function useGalleryFeed(query: GalleryFeedQuery, libraryReady: boolean) {
  const queryKey = useMemo(() => buildGalleryQueryKey(query), [query]);
  const initialSnapshot = useMemo(() => getGallerySnapshot(queryKey), [queryKey]);

  const [cards, setCards] = useState<CardRecord[]>(() => initialSnapshot?.cards ?? []);
  const [srcMap, setSrcMap] = useState<Record<string, string>>(() => initialSnapshot?.srcMap ?? {});
  const [offset, setOffset] = useState(() => initialSnapshot?.offset ?? 0);
  const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(() => libraryReady && !initialSnapshot);

  const loadSeqRef = useRef(0);
  const cardsRef = useRef(cards);
  const srcMapRef = useRef(srcMap);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    srcMapRef.current = srcMap;
  }, [srcMap]);

  const applySnapshot = useCallback((snapshot: GalleryScopeSnapshot) => {
    setCards(snapshot.cards);
    setSrcMap(snapshot.srcMap);
    setOffset(snapshot.offset);
    setHasMore(snapshot.hasMore);
  }, []);

  const persistSnapshot = useCallback(
    (snapshot: GalleryScopeSnapshot) => {
      setGallerySnapshot(queryKey, snapshot);
      applySnapshot(snapshot);
    },
    [applySnapshot, queryKey]
  );

  const fetchPage = useCallback(
    async (start: number, append: boolean, seq: number, options?: { preloadDecode?: boolean }) => {
      const take = start === 0 ? GALLERY_PAGE_INITIAL : GALLERY_PAGE_MORE;
      const chunk = await listCardsPage({
        offset: start,
        limit: take,
        filter: query.filter,
        libraryScope: query.libraryScope,
        selectedTagIds: query.selectedTagIds,
        cardIdExact: query.cardIdExact
      });

      if (seq !== loadSeqRef.current) return;

      const hasMoreNext = chunk.length === take;
      const nextOffset = start + chunk.length;
      const prevCards = cardsRef.current;
      const prevSrcMap = srcMapRef.current;
      const nextCards = append ? [...prevCards, ...chunk] : chunk;

      if (!append) {
        const cached = getGallerySnapshot(queryKey);
        if (cached && sameCardOrder(cached.cards, chunk)) {
          const mergedSrc = await mergeCardsSrcMap(chunk, { ...cached.srcMap, ...peekCardsSrcMap(chunk) });
          if (seq !== loadSeqRef.current) return;
          persistSnapshot({
            cards: chunk,
            srcMap: mergedSrc,
            offset: nextOffset,
            hasMore: hasMoreNext
          });
          if (options?.preloadDecode) {
            await preloadDecodedImages(Object.values(mergedSrc));
          }
          return;
        }
      }

      const peek = peekCardsSrcMap(nextCards);
      const baseSrc = append ? { ...prevSrcMap, ...peek } : peek;
      const resolved = await mergeCardsSrcMap(append ? chunk : nextCards, baseSrc);
      if (seq !== loadSeqRef.current) return;

      persistSnapshot({
        cards: nextCards,
        srcMap: resolved,
        offset: nextOffset,
        hasMore: hasMoreNext
      });

      if (options?.preloadDecode) {
        await preloadDecodedImages(Object.values(resolved));
      }
    },
    [persistSnapshot, query, queryKey]
  );

  const reloadFromStart = useCallback(
    async (options?: { preloadDecode?: boolean; showBoot?: boolean; clearDisplay?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (options?.clearDisplay) {
        setCards([]);
        setSrcMap({});
        setOffset(0);
        setHasMore(true);
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
    [fetchPage]
  );

  useEffect(() => {
    if (!libraryReady) {
      setBooting(false);
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
  }, [applySnapshot, fetchPage, libraryReady, queryKey]);

  useEffect(() => {
    const onCardsChanged = () => {
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
      invalidateAllGallerySnapshots();
      void reloadFromStart({ preloadDecode: true, showBoot: true, clearDisplay: true });
    };
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
      window.removeEventListener('arc:library-changed', onLibraryChanged);
    };
  }, [fetchPage, reloadFromStart]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const seq = loadSeqRef.current;
    setLoading(true);
    try {
      await fetchPage(offset, true, seq);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [fetchPage, hasMore, loading, offset]);

  return {
    cards,
    srcMap,
    offset,
    hasMore,
    loading,
    booting,
    loadMore,
    reloadFromStart
  };
}
