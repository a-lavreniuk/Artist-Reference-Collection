import { useEffect, useState } from 'react';
import { getAllCategories, getTagsByCategory } from '../../services/db';
import { getAllCollections } from '../../services/db';
import type { CardRecord, CollectionRecord } from '../../services/arcSchema';
import type { CategoryRecord, TagRecord } from '../../services/db';

export type DuplicatePairDetails = {
  categories: CategoryRecord[];
  tagsByCategory: Map<string, TagRecord[]>;
  collectionsById: Map<string, CollectionRecord>;
  loading: boolean;
};

export function useDuplicatePairDetails(cardA?: CardRecord | null, cardB?: CardRecord | null): DuplicatePairDetails {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Map<string, TagRecord[]>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, CollectionRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const cats = await getAllCategories();
        const cols = await getAllCollections();
        const tagMap = new Map<string, TagRecord[]>();
        for (const cat of cats) {
          tagMap.set(cat.id, await getTagsByCategory(cat.id));
        }
        if (cancelled) return;
        setCategories(cats);
        setTagsByCategory(tagMap);
        setCollectionsById(new Map(cols.map((c) => [c.id, c])));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardA?.id, cardB?.id]);

  return { categories, tagsByCategory, collectionsById, loading };
}
