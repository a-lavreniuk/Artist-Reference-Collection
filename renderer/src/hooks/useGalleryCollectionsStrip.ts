import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sortCollectionsForGalleryStrip } from '../components/collections/sortCollectionsForGalleryStrip';
import { childSections, rootCollections } from '@arc-main-shared/collectionHierarchy';
import { newShuffleSeed } from '../components/gallery/shuffleCardIds';
import type { GalleryCollectionsSortMode } from '../services/appPreferences';
import type { CardRecord, CollectionRecord } from '../services/db';
import { useCollectionsMeta } from './useCollectionsMeta';

type StripItem = {
  collection: CollectionRecord;
  count: number;
  previews: CardRecord[];
  sectionCount: number;
};

export function useGalleryCollectionsStrip(
  enabled: boolean,
  sortMode: GalleryCollectionsSortMode
): { items: StripItem[]; loading: boolean } {
  const location = useLocation();
  const onGallery = location.pathname === '/gallery';
  const { collections, counts, previews, loaded } = useCollectionsMeta(enabled && onGallery);
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

  const sorted = useMemo(
    () => sortCollectionsForGalleryStrip(rootCollections(collections), counts, sortMode, randomSeed),
    [collections, counts, sortMode, randomSeed]
  );

  const items = useMemo<StripItem[]>(() => {
    if (!enabled) return [];
    return sorted.map((collection) => ({
      collection,
      count: counts[collection.id] ?? 0,
      previews: previews[collection.id] ?? [],
      sectionCount: childSections(collections, collection.id).length
    }));
  }, [enabled, sorted, counts, previews, collections]);

  return { items, loading: enabled && onGallery && !loaded };
}
