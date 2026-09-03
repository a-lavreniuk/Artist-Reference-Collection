import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sortCollectionsForGalleryStrip } from '../components/collections/sortCollectionsForGalleryStrip';
import { childSections, rootCollections } from '@arc-main-shared/collectionHierarchy';
import { newShuffleSeed } from '../components/gallery/shuffleCardIds';
import {
  countActiveFilterCategories,
  type GalleryAdvancedFilters
} from '../components/gallery/galleryFilterTypes';
import type { GalleryCollectionsSortMode } from '../services/appPreferences';
import type { CardRecord, CollectionRecord } from '../services/db';
import { ARC_CARDS_CHANGED_EVENT, ARC_COLLECTIONS_CHANGED_EVENT } from '../services/db';
import { storageCollectionsSidebar } from '../services/storageClient';
import { useCollectionsMeta } from './useCollectionsMeta';

type StripItem = {
  collection: CollectionRecord;
  count: number;
  previews: CardRecord[];
  sectionCount: number;
};

type FilteredMeta = {
  collections: CollectionRecord[];
  counts: Record<string, number>;
  previews: Record<string, CardRecord[]>;
};

export function useGalleryCollectionsStrip(
  enabled: boolean,
  sortMode: GalleryCollectionsSortMode,
  filters?: GalleryAdvancedFilters
): { items: StripItem[]; loading: boolean } {
  const location = useLocation();
  const onGallery = location.pathname === '/gallery';
  const filtersActive = Boolean(filters && countActiveFilterCategories(filters) > 0);
  const useUnfilteredMeta = enabled && onGallery && !filtersActive;
  const { collections: storeCollections, counts: storeCounts, previews: storePreviews, loaded } =
    useCollectionsMeta(useUnfilteredMeta);
  const [filteredMeta, setFilteredMeta] = useState<FilteredMeta | null>(null);
  const [filteredLoaded, setFilteredLoaded] = useState(false);
  const [randomSeed, setRandomSeed] = useState(() => newShuffleSeed());
  const prevPathRef = useRef(location.pathname);
  const filtersKey = filtersActive && filters ? JSON.stringify(filters) : '';

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

  useEffect(() => {
    if (!enabled || !onGallery || !filtersActive || !filters) {
      setFilteredMeta(null);
      setFilteredLoaded(false);
      return;
    }
    setFilteredMeta(null);
    setFilteredLoaded(false);
    let cancelled = false;
    const load = () => {
      void storageCollectionsSidebar({ previewLimit: 4, advancedFilters: filters })
        .then((meta) => {
          if (cancelled) return;
          setFilteredMeta({
            collections: meta.collections ?? [],
            counts: meta.counts ?? {},
            previews: meta.previews ?? {}
          });
          setFilteredLoaded(true);
        })
        .catch(() => {
          if (cancelled) return;
          setFilteredMeta({ collections: [], counts: {}, previews: {} });
          setFilteredLoaded(true);
        });
    };
    load();
    const refresh = () => load();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, refresh);
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, refresh);
    window.addEventListener('arc:library-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, refresh);
      window.removeEventListener('arc:library-changed', refresh);
    };
  }, [enabled, onGallery, filtersActive, filtersKey, filters]);

  const collections = filtersActive ? (filteredMeta?.collections ?? []) : storeCollections;
  const counts = filtersActive ? (filteredMeta?.counts ?? {}) : storeCounts;
  const previews = filtersActive ? (filteredMeta?.previews ?? {}) : storePreviews;

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

  const loading =
    enabled &&
    onGallery &&
    (filtersActive ? !filteredLoaded : !loaded);

  return { items, loading };
}
