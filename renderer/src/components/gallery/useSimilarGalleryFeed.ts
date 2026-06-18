import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dispatchSimilarSearchLoading } from '../../search/similarSearchEvents';
import { getSimilarUploadPath } from '../../search/similarSearchSession';
import type { SimilarCropRect } from '../../search/searchUrl';
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

export type SimilarGalleryFeedOptions = {
  scopeCardIds?: ReadonlySet<string> | null;
};

export type SimilarSearchRef =
  | { kind: 'card'; cardId: string }
  | { kind: 'upload' }
  | null;

export function useSimilarGalleryFeed(
  similarRef: SimilarSearchRef,
  crop: SimilarCropRect,
  feedQuery: GalleryFeedQuery,
  libraryReady: boolean,
  options?: SimilarGalleryFeedOptions
) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const scopeCardIds = options?.scopeCardIds ?? null;

  const requestPayload = useMemo(() => {
    if (!similarRef) return null;
    const uploadPath = similarRef.kind === 'upload' ? getSimilarUploadPath() : null;
    if (similarRef.kind === 'upload' && !uploadPath) return null;
    return {
      cardId: similarRef.kind === 'card' ? similarRef.cardId : null,
      imagePath: similarRef.kind === 'upload' ? uploadPath : null,
      crop,
      libraryScope: feedQuery.libraryScope,
      selectedTagIds: feedQuery.selectedTagIds,
      cardIdExact: feedQuery.cardIdExact,
      collectionId: feedQuery.collectionId ?? null,
      moodboardCardIds: feedQuery.moodboardCardIds ?? null,
      advancedFilters: feedQuery.advancedFilters,
      sort: feedQuery.sort,
      scopeCardIds: scopeCardIds ? [...scopeCardIds] : undefined
    };
  }, [crop, feedQuery, scopeCardIds, similarRef]);

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

  useEffect(() => {
    dispatchSimilarSearchLoading(loading);
  }, [loading]);

  const reload = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.aiSimilarSearchCards || !requestPayload || !libraryReady) {
      setCards([]);
      setSrcMap({});
      setError(null);
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const status = arc.aiGetStatus ? await arc.aiGetStatus() : null;
      if (status && !status.setupReady) {
        throw new Error('Сначала установите модель в «Настройки → AI Поиск».');
      }
      const raw = await arc.aiSimilarSearchCards(requestPayload);
      const rows = Array.isArray(raw) ? (raw as CardRecord[]) : [];
      if (seq !== seqRef.current) return;
      const ordered = applySortOrder(rows);
      setCards(ordered);
      const gridSize = readGridSize();
      const map = await mergeCardsSrcMap(ordered, peekCardsSrcMap(ordered, gridSize), gridSize);
      if (seq !== seqRef.current) return;
      setSrcMap(map);
      void preloadDecodedImages(Object.values(map));
    } catch (err) {
      if (seq !== seqRef.current) return;
      setCards([]);
      setSrcMap({});
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [applySortOrder, libraryReady, requestPayload]);

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
    error
  };
}
