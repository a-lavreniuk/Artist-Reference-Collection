import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardRecord } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import type { GalleryFeedQuery } from './galleryQuery';
import { isGalleryShuffleSort } from './galleryFilterTypes';
import {
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from './galleryMediaCache';
import { orderRecordsByIds, shuffleCardIds } from './shuffleCardIds';

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
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

  const hex = useMemo(() => colorHex?.trim().toUpperCase() ?? '', [colorHex]);
  const scopeCardIds = options?.scopeCardIds ?? null;

  const requestPayload = useMemo(
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

  const applySortOrder = useCallback(
    (rows: CardRecord[]) => {
      const sort = feedQuery.sort;
      if (!isGalleryShuffleSort(sort)) return rows;
      const shuffledIds = shuffleCardIds(
        rows.map((r) => r.id),
        sort.shuffleSeed ?? 0
      );
      return orderRecordsByIds(rows, shuffledIds);
    },
    [feedQuery.sort]
  );

  const reload = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.colorSearchCards || !hex || !libraryReady) {
      setCards([]);
      setSrcMap({});
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const raw = await arc.colorSearchCards(requestPayload);
      const rows = Array.isArray(raw) ? (raw as CardRecord[]) : [];
      if (seq !== seqRef.current) return;
      const ordered = applySortOrder(rows);
      setCards(ordered);
      const gridSize = readGridSize();
      const map = await mergeCardsSrcMap(ordered, peekCardsSrcMap(ordered, gridSize), gridSize);
      if (seq !== seqRef.current) return;
      setSrcMap(map);
      void preloadDecodedImages(Object.values(map));
    } catch {
      if (seq !== seqRef.current) return;
      setCards([]);
      setSrcMap({});
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [applySortOrder, hex, libraryReady, requestPayload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    cards,
    srcMap,
    hasMore: false,
    loading,
    booting: false,
    loadMore: () => {},
    reloadFromStart: reload,
    error: null as string | null
  };
}
