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
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_MOODBOARD_BOARD_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getMoodboardCardIds,
  readTagsUnified,
  type TagRecord
} from '../services/db';
import { subscribeGalleryCardsChanged } from '../components/gallery/galleryFeedCardsChanged';
import { onGalleryFeedSettled } from '../components/gallery/galleryFeedSettled';

type GalleryMetaContextValue = {
  tagsIndex: Map<string, TagRecord>;
  moodboardCardIds: Set<string>;
  moodboardIdsReady: boolean;
  tagsReady: boolean;
  metaReady: boolean;
  refreshTags: () => Promise<void>;
  refreshMoodboard: () => Promise<void>;
};

const GalleryMetaContext = createContext<GalleryMetaContextValue | null>(null);

export function GalleryMetaProvider({ children }: { children: ReactNode }) {
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [moodboardIdsReady, setMoodboardIdsReady] = useState(false);
  const [tagsReady, setTagsReady] = useState(false);

  const refreshTags = useCallback(async () => {
    const tags = await readTagsUnified();
    const m = new Map<string, TagRecord>();
    for (const t of tags) m.set(t.id, t);
    setTagsIndex(m);
    setTagsReady(true);
  }, []);

  const refreshMoodboard = useCallback(async () => {
    const ids = await getMoodboardCardIds();
    setMoodboardCardIds(new Set(ids));
    setMoodboardIdsReady(true);
  }, []);

  useEffect(() => {
    let idleId: number | undefined;
    let fallbackTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void refreshMoodboard();
      window.setTimeout(() => {
        if (!cancelled) void refreshTags();
      }, 800);
    };

    const schedule = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(run, { timeout: 4000 });
      } else {
        fallbackTimeoutId = window.setTimeout(run, 2000);
      }
    };

    const unsubSettled = onGalleryFeedSettled(schedule);
    fallbackTimeoutId = window.setTimeout(schedule, 12000);

    return () => {
      cancelled = true;
      unsubSettled();
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackTimeoutId !== undefined) {
        window.clearTimeout(fallbackTimeoutId);
      }
    };
  }, [refreshMoodboard, refreshTags]);

  useEffect(() => {
    const onTags = () => void refreshTags();
    const onMoodboard = () => void refreshMoodboard();
    const unsubCards = subscribeGalleryCardsChanged(onMoodboard);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onTags);
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onTags);
    window.addEventListener(ARC_MOODBOARD_BOARD_CHANGED_EVENT, onMoodboard);
    return () => {
      unsubCards();
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onTags);
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onTags);
      window.removeEventListener(ARC_MOODBOARD_BOARD_CHANGED_EVENT, onMoodboard);
    };
  }, [refreshMoodboard, refreshTags]);

  const metaReady = moodboardIdsReady && tagsReady;

  const value = useMemo(
    () => ({
      tagsIndex,
      moodboardCardIds,
      moodboardIdsReady,
      tagsReady,
      metaReady,
      refreshTags,
      refreshMoodboard
    }),
    [metaReady, moodboardCardIds, moodboardIdsReady, refreshMoodboard, refreshTags, tagsIndex, tagsReady]
  );

  return <GalleryMetaContext.Provider value={value}>{children}</GalleryMetaContext.Provider>;
}

export function useGalleryMeta(): GalleryMetaContextValue {
  const ctx = useContext(GalleryMetaContext);
  if (!ctx) throw new Error('useGalleryMeta вне GalleryMetaProvider');
  return ctx;
}
