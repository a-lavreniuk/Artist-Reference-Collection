import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardRecord } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import {
  mergeCardsSrcMap,
  peekCardsSrcMap,
  preloadDecodedImages
} from '../gallery/galleryMediaCache';

export function useAiGalleryFeed(aiQuery: string | null, libraryReady: boolean) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const query = useMemo(() => aiQuery?.trim() ?? '', [aiQuery]);

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

      setCards(rows);
      const gridSize = readGridSize();
      const map = await mergeCardsSrcMap(rows, peekCardsSrcMap(rows, gridSize), gridSize);
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
  }, [libraryReady, query]);

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
