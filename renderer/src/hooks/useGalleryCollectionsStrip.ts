import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sortCollectionsForGalleryStrip } from '../components/collections/sortCollectionsForGalleryStrip';
import { newShuffleSeed } from '../components/gallery/shuffleCardIds';
import type { GalleryCollectionsSortMode } from '../services/appPreferences';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  getCollectionsSidebarMeta,
  type CardRecord,
  type CollectionRecord
} from '../services/db';

type StripItem = {
  collection: CollectionRecord;
  count: number;
  previews: CardRecord[];
};

export function useGalleryCollectionsStrip(
  enabled: boolean,
  sortMode: GalleryCollectionsSortMode
): { items: StripItem[]; loading: boolean } {
  const location = useLocation();
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [previews, setPreviews] = useState<Record<string, CardRecord[]>>({});
  const [loading, setLoading] = useState(false);
  const [randomSeed, setRandomSeed] = useState(() => newShuffleSeed());
  const prevPathRef = useRef(location.pathname);
  const reloadGenRef = useRef(0);

  useEffect(() => {
    if (location.pathname === '/gallery' && prevPathRef.current !== '/gallery') {
      setRandomSeed(newShuffleSeed());
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (sortMode === 'random') {
      setRandomSeed(newShuffleSeed());
    }
  }, [sortMode]);

  const reload = useCallback(async () => {
    const gen = ++reloadGenRef.current;
    if (!enabled || location.pathname !== '/gallery') {
      setCollections([]);
      setCounts({});
      setPreviews({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const meta = await getCollectionsSidebarMeta(4);
      if (gen !== reloadGenRef.current || !enabled || location.pathname !== '/gallery') return;
      setCollections(meta.collections);
      setCounts(meta.counts);
      setPreviews(meta.previews);
    } finally {
      if (gen === reloadGenRef.current) setLoading(false);
    }
  }, [enabled, location.pathname]);

  useEffect(() => {
    if (enabled) return;
    reloadGenRef.current += 1;
    setCollections([]);
    setCounts({});
    setPreviews({});
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || location.pathname !== '/gallery') return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      idleId = undefined;
      timeoutId = undefined;
      void reload();
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 12000 });
    } else {
      timeoutId = window.setTimeout(run, 5000);
    }
    return () => {
      reloadGenRef.current += 1;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, location.pathname, reload]);

  useEffect(() => {
    if (!enabled || location.pathname !== '/gallery') return;
    const onChange = () => void reload();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onChange);
    window.addEventListener('arc:cards-changed', onChange);
    window.addEventListener('arc:library-changed', onChange);
    return () => {
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onChange);
      window.removeEventListener('arc:cards-changed', onChange);
      window.removeEventListener('arc:library-changed', onChange);
    };
  }, [enabled, location.pathname, reload]);

  const sorted = useMemo(
    () => sortCollectionsForGalleryStrip(collections, counts, sortMode, randomSeed),
    [collections, counts, sortMode, randomSeed]
  );

  const items = useMemo<StripItem[]>(
    () =>
      sorted.map((collection) => ({
        collection,
        count: counts[collection.id] ?? 0,
        previews: previews[collection.id] ?? []
      })),
    [sorted, counts, previews]
  );

  return { items, loading };
}
