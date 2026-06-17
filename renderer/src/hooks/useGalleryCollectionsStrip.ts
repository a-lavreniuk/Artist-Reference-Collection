import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sortCollectionsForGalleryStrip } from '../components/collections/sortCollectionsForGalleryStrip';
import { newShuffleSeed } from '../components/gallery/shuffleCardIds';
import type { GalleryCollectionsSortMode } from '../services/appPreferences';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
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
    if (!enabled) {
      setCollections([]);
      setCounts({});
      setPreviews({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cols, nextCounts, nextPreviews] = await Promise.all([
        getAllCollections(),
        getCollectionCardCounts(),
        getCollectionPreviewSlices(4)
      ]);
      setCollections(cols);
      setCounts(nextCounts);
      setPreviews(nextPreviews);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void reload();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onChange);
    window.addEventListener('arc:cards-changed', onChange);
    window.addEventListener('arc:library-changed', onChange);
    return () => {
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onChange);
      window.removeEventListener('arc:cards-changed', onChange);
      window.removeEventListener('arc:library-changed', onChange);
    };
  }, [enabled, reload]);

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
