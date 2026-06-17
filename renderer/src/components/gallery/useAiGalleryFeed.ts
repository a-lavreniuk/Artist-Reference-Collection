import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardRecord } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import type { GallerySortState } from './galleryFilterTypes';
import { isGalleryShuffleSort } from './galleryFilterTypes';
import {
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from './galleryMediaCache';
import { orderRecordsByIds, shuffleCardIds } from './shuffleCardIds';

export function useAiGalleryFeed(
  aiQuery: string | null,
  libraryReady: boolean,
  sort: GallerySortState
) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const query = useMemo(() => aiQuery?.trim() ?? '', [aiQuery]);

  const applySortOrder = useCallback(
    (rows: CardRecord[]) => {
      if (!isGalleryShuffleSort(sort)) return rows;
      const shuffledIds = shuffleCardIds(
        rows.map((r) => r.id),
        sort.shuffleSeed ?? 0
      );
      return orderRecordsByIds(rows, shuffledIds);
    },
    [sort]
  );

  const reloadFromStart = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.aiSearchCards || !query || !libraryReady) {
      setCards([]);
      setSrcMap({});
      setError(null);
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setBooting(true);
    setError(null);

    try {
      const status = arc.aiGetStatus ? await arc.aiGetStatus() : null;
      if (status && !status.setupReady) {
        throw new Error('Сначала установите модель в «Настройки → AI Поиск».');
      }

      const raw = await arc.aiSearchCards(query);
      const rows = Array.isArray(raw) ? (raw as Array<CardRecord & { aiScore?: number }>) : [];
      if (seq !== seqRef.current) return;

      if (rows.length === 0) {
        setError('Ничего не найдено. Попробуйте другой запрос или дождитесь индексации.');
      }

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
      setError(err instanceof Error ? err.message : 'Не удалось выполнить AI-поиск');
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setBooting(false);
      }
    }
  }, [applySortOrder, libraryReady, query]);

  useEffect(() => {
    void reloadFromStart();
  }, [reloadFromStart]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onAiError) return;
    const unsub = arc.onAiError(({ message }) => {
      if (query) setError(message);
    });
    return () => unsub?.();
  }, [query]);

  return {
    cards,
    srcMap,
    hasMore: false,
    loading,
    booting,
    loadMore: () => {},
    reloadFromStart,
    error
  };
}
