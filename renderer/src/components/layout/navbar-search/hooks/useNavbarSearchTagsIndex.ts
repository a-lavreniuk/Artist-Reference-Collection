import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  type CategoryRecord,
  type TagRecord
} from '../../../../services/db';

export function useNavbarSearchTagsIndex() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const tagsByCategoryRef = useRef<Map<string, TagRecord[]>>(new Map());
  const [tagsVersion, setTagsVersion] = useState(0);

  const loadIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const sorted = [...cats].sort((a, b) => a.sortIndex - b.sortIndex);
    setCategories(sorted);
    const map = new Map<string, TagRecord[]>();
    await Promise.all(
      sorted.map(async (c) => {
        const tags = await getTagsByCategory(c.id);
        map.set(c.id, tags);
      })
    );
    tagsByCategoryRef.current = map;
    setTagsVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    const onCats = () => void loadIndex();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    };
  }, [loadIndex]);

  return {
    categories,
    tagsByCategoryRef,
    tagsVersion,
    loadIndex
  };
}
