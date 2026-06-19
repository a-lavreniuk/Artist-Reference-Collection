import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import { GALLERY_PAGE_INITIAL, GALLERY_PAGE_MORE } from './galleryQuery';
import { mergeCardsSrcMap, peekCardsSrcMap, preloadDecodedImages } from './galleryMediaCache';

type FetchPage = (offset: number, limit: number) => Promise<CardRecord[]>;

type Options = {
  enabled: boolean;
  fetchPage: FetchPage;
  resetKey: string;
};

export function usePaginatedRemoteFeed({ enabled, fetchPage, resetKey }: Options) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const srcMapRef = useRef<Record<string, string>>({});
  const hadDataRef = useRef(false);

  useEffect(() => {
    srcMapRef.current = srcMap;
  }, [srcMap]);

  const applyChunk = useCallback(async (rows: CardRecord[], append: boolean, take: number, seq: number) => {
    if (seq !== seqRef.current) return;
    setError(null);
    setHasMore(rows.length === take);
    const gridSize = readGridSize();
    const peek = peekCardsSrcMap(rows, gridSize);
    const base = append ? { ...srcMapRef.current, ...peek } : peek;
    const resolved = await mergeCardsSrcMap(rows, base, gridSize);
    if (seq !== seqRef.current) return;
    setCards((prev) => (append ? [...prev, ...rows] : rows));
    setSrcMap(resolved);
    srcMapRef.current = resolved;
    setOffset((prev) => (append ? prev + rows.length : rows.length));
    hadDataRef.current = true;
    void preloadDecodedImages(Object.values(resolved));
  }, []);

  const reloadFromStart = useCallback(async () => {
    if (!enabled) {
      setCards([]);
      setSrcMap({});
      srcMapRef.current = {};
      setOffset(0);
      setHasMore(false);
      setLoading(false);
      setBooting(false);
      setError(null);
      hadDataRef.current = false;
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setBooting(!hadDataRef.current);
    setError(null);
    try {
      const take = GALLERY_PAGE_INITIAL;
      const rows = await fetchPage(0, take);
      if (seq !== seqRef.current) return;
      await applyChunk(rows, false, take, seq);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setCards([]);
      setSrcMap({});
      srcMapRef.current = {};
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить результаты');
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setBooting(false);
      }
    }
  }, [applyChunk, enabled, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || !hasMore) return;
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const take = GALLERY_PAGE_MORE;
      const rows = await fetchPage(offset, take);
      if (seq !== seqRef.current) return;
      await applyChunk(rows, true, take, seq);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : 'Не удалось загрузить результаты');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [applyChunk, enabled, fetchPage, hasMore, loading, offset]);

  useEffect(() => {
    void reloadFromStart();
  }, [resetKey, reloadFromStart]);

  return {
    cards,
    srcMap,
    hasMore,
    loading,
    booting,
    error,
    loadMore,
    reloadFromStart
  };
}
