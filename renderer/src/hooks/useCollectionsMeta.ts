import { useEffect, useState } from 'react';
import type { CardRecord, CollectionRecord } from '../services/db';
import {
  getCollectionsMetaSnapshot,
  loadCollectionsMeta,
  subscribeCollectionsMeta
} from './collectionsMetaStore';

export function useCollectionsMeta(enabled: boolean): {
  collections: CollectionRecord[];
  counts: Record<string, number>;
  previews: Record<string, CardRecord[]>;
  loaded: boolean;
} {
  const [, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(() => getCollectionsMetaSnapshot() != null);

  useEffect(() => subscribeCollectionsMeta(() => setVersion((value) => value + 1)), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadCollectionsMeta({ force: true }).then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const snapshot = getCollectionsMetaSnapshot();
  return {
    collections: snapshot?.collections ?? [],
    counts: snapshot?.counts ?? {},
    previews: snapshot?.previews ?? {},
    loaded: loaded || snapshot != null
  };
}
