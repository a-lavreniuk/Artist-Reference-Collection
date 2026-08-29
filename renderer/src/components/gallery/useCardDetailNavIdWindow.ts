import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeGalleryCardsChanged } from './galleryFeedCardsChanged';
import { buildGalleryQueryKey, type GalleryFeedQuery } from './galleryQuery';
import { listCardIdsAroundForQuery } from './gallerySelectAllIds';

/**
 * Стабильное окно id вокруг открытой карточки для стрелок деталки.
 * Не зависит от обрезанной ленты в памяти (до 500 карточек).
 */
export function useCardDetailNavIdWindow(
  query: GalleryFeedQuery | null,
  openCardId: string | null
): string[] {
  const [ids, setIds] = useState<string[]>([]);
  const queryRef = useRef(query);
  queryRef.current = query;
  const queryKey = useMemo(() => (query ? buildGalleryQueryKey(query) : ''), [query]);

  useEffect(() => {
    setIds([]);
  }, [queryKey]);

  useEffect(() => {
    if (!queryKey || !openCardId) {
      setIds([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      const q = queryRef.current;
      if (!q) return;
      void listCardIdsAroundForQuery(q, openCardId).then((next) => {
        if (cancelled) return;
        if (next.length > 0 && next.includes(openCardId)) {
          setIds(next);
          return;
        }
        setIds([]);
      });
    };
    load();
    const unsubscribe = subscribeGalleryCardsChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [openCardId, queryKey]);

  return ids;
}
