import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  ARC_CARDS_CHANGED_EVENT,
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_MOODBOARD_BOARD_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getAllCategories,
  getMoodboardCardIds,
  getTagsByCategory,
  type TagRecord
} from '../services/db';

type GalleryMetaContextValue = {
  tagsIndex: Map<string, TagRecord>;
  moodboardCardIds: Set<string>;
  metaReady: boolean;
  refreshTags: () => Promise<void>;
  refreshMoodboard: () => Promise<void>;
};

const GalleryMetaContext = createContext<GalleryMetaContextValue | null>(null);

export function GalleryMetaProvider({ children }: { children: ReactNode }) {
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [metaReady, setMetaReady] = useState(false);

  const refreshTags = useCallback(async () => {
    const cats = await getAllCategories();
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const m = new Map<string, TagRecord>();
    for (const list of lists) {
      for (const t of list) m.set(t.id, t);
    }
    setTagsIndex(m);
  }, []);

  const refreshMoodboard = useCallback(async () => {
    const ids = await getMoodboardCardIds();
    setMoodboardCardIds(new Set(ids));
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([refreshTags(), refreshMoodboard()]);
      setMetaReady(true);
    })();
  }, [refreshMoodboard, refreshTags]);

  useEffect(() => {
    const onTags = () => void refreshTags();
    const onMoodboard = () => void refreshMoodboard();
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onTags);
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onTags);
    window.addEventListener(ARC_MOODBOARD_BOARD_CHANGED_EVENT, onMoodboard);
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onMoodboard);
    return () => {
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onTags);
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onTags);
      window.removeEventListener(ARC_MOODBOARD_BOARD_CHANGED_EVENT, onMoodboard);
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onMoodboard);
    };
  }, [refreshMoodboard, refreshTags]);

  const value = useMemo(
    () => ({ tagsIndex, moodboardCardIds, metaReady, refreshTags, refreshMoodboard }),
    [metaReady, moodboardCardIds, refreshMoodboard, refreshTags, tagsIndex]
  );

  return <GalleryMetaContext.Provider value={value}>{children}</GalleryMetaContext.Provider>;
}

export function useGalleryMeta(): GalleryMetaContextValue {
  const ctx = useContext(GalleryMetaContext);
  if (!ctx) throw new Error('useGalleryMeta вне GalleryMetaProvider');
  return ctx;
}
