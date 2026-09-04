import { useEffect, useState } from 'react';
import { getAllCategories, getAllCollections, readTagsUnified } from '../../services/db';
import type { CardRecord, CollectionRecord } from '../../services/arcSchema';
import type { CategoryRecord, TagRecord } from '../../services/db';

export type DuplicatePairDetails = {
  categories: CategoryRecord[];
  tagsByCategory: Map<string, TagRecord[]>;
  collectionsById: Map<string, CollectionRecord>;
  loading: boolean;
};

export function tagsByCategoryMap(tags: TagRecord[]): Map<string, TagRecord[]> {
  const tagMap = new Map<string, TagRecord[]>();
  for (const tag of tags) {
    const list = tagMap.get(tag.categoryId);
    if (list) list.push(tag);
    else tagMap.set(tag.categoryId, [tag]);
  }
  for (const list of tagMap.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  return tagMap;
}

export function mergeCollectionsById(
  ...lists: Array<Iterable<CollectionRecord> | undefined>
): Map<string, CollectionRecord> {
  const map = new Map<string, CollectionRecord>();
  for (const list of lists) {
    if (!list) continue;
    for (const col of list) {
      if (col?.id) map.set(col.id, col);
    }
  }
  return map;
}

export function mergeTagsById(...lists: Array<Iterable<TagRecord> | undefined>): TagRecord[] {
  const map = new Map<string, TagRecord>();
  for (const list of lists) {
    if (!list) continue;
    for (const tag of list) {
      if (tag?.id) map.set(tag.id, tag);
    }
  }
  return [...map.values()];
}

export function mergeCategoriesById(
  ...lists: Array<Iterable<CategoryRecord> | undefined>
): CategoryRecord[] {
  const map = new Map<string, CategoryRecord>();
  for (const list of lists) {
    if (!list) continue;
    for (const cat of list) {
      if (cat?.id) map.set(cat.id, cat);
    }
  }
  return [...map.values()].sort(
    (a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru')
  );
}

type PairCatalog = {
  categories?: CategoryRecord[];
  tags?: TagRecord[];
  collectionsA?: CollectionRecord[];
  collectionsB?: CollectionRecord[];
};

export function useDuplicatePairDetails(
  cardA?: CardRecord | null,
  cardB?: CardRecord | null,
  catalog?: PairCatalog
): DuplicatePairDetails {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Map<string, TagRecord[]>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, CollectionRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  const pairCatalogCategories = catalog?.categories;
  const pairCatalogTags = catalog?.tags;
  const collectionsA = catalog?.collectionsA;
  const collectionsB = catalog?.collectionsB;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [activeCats, activeTags, activeCols] = await Promise.all([
          getAllCategories(),
          readTagsUnified(),
          getAllCollections()
        ]);
        if (cancelled) return;
        setCategories(mergeCategoriesById(activeCats, pairCatalogCategories));
        setTagsByCategory(tagsByCategoryMap(mergeTagsById(activeTags, pairCatalogTags)));
        setCollectionsById(mergeCollectionsById(activeCols, collectionsA, collectionsB));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardA?.id, cardB?.id, pairCatalogCategories, pairCatalogTags, collectionsA, collectionsB]);

  return { categories, tagsByCategory, collectionsById, loading };
}
