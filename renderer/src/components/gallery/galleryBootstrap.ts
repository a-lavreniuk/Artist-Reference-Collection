import { listCardsPage } from '../../services/db';
import {
  buildGalleryQueryKey,
  defaultGalleryFeedQuery,
  GALLERY_PAGE_INITIAL,
  GALLERY_WARMUP_SCOPES,
  type GalleryFeedQuery
} from './galleryQuery';
import { readGridSize } from '../../layout/gridSizePreference';
import { mergeCardsSrcMap, peekCardsSrcMap, type MediaSectionTab } from './galleryMediaCache';
import { getGallerySnapshot, setGallerySnapshot } from './galleryScopeCache';

const bootPromises = new Map<string, Promise<void>>();

async function loadFirstPageIntoCache(query: GalleryFeedQuery, mediaSection?: MediaSectionTab): Promise<void> {
  const key = buildGalleryQueryKey(query);
  if (getGallerySnapshot(key)) {
    return;
  }

  const chunk = await listCardsPage({
    offset: 0,
    limit: GALLERY_PAGE_INITIAL,
    libraryScope: query.libraryScope,
    selectedTagIds: query.selectedTagIds,
    cardIdExact: query.cardIdExact,
    collectionId: query.collectionId,
    moodboardCardIds: query.moodboardCardIds,
    advancedFilters: query.advancedFilters,
    sort: query.sort
  });

  const gridSize = readGridSize();
  const peek = peekCardsSrcMap(chunk, gridSize, mediaSection);
  const srcMap = await mergeCardsSrcMap(chunk, peek, gridSize, mediaSection);
  const snapshot = {
    cards: chunk,
    srcMap,
    offset: chunk.length,
    hasMore: chunk.length === GALLERY_PAGE_INITIAL
  };
  setGallerySnapshot(key, snapshot);
}

export function ensureGalleryBootstrap(
  query: GalleryFeedQuery = defaultGalleryFeedQuery(),
  mediaSection?: MediaSectionTab
): Promise<void> {
  const key = buildGalleryQueryKey(query);
  if (getGallerySnapshot(key)) {
    return Promise.resolve();
  }
  const existing = bootPromises.get(key);
  if (existing) return existing;

  const promise = loadFirstPageIntoCache(query, mediaSection).finally(() => {
    bootPromises.delete(key);
  });
  bootPromises.set(key, promise);
  return promise;
}

export function warmGalleryQuery(query: GalleryFeedQuery): void {
  void ensureGalleryBootstrap(query).catch(() => {
    // Фоновый прогрев не блокирует UI.
  });
}

export function warmMoodboardGallery(moodboardCardIds: readonly string[]): void {
  if (moodboardCardIds.length === 0) return;
  warmGalleryQuery({
    ...defaultGalleryFeedQuery('all'),
    moodboardCardIds: [...moodboardCardIds]
  });
}

let warmupIdleId: number | null = null;
let warmupTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function scheduleGalleryWarmup(): void {
  const run = () => {
    warmupIdleId = null;
    warmupTimeoutId = null;
    void warmGalleryScopes();
  };

  if (warmupIdleId !== null && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(warmupIdleId);
    warmupIdleId = null;
  }
  if (warmupTimeoutId !== null) {
    clearTimeout(warmupTimeoutId);
    warmupTimeoutId = null;
  }

  if (typeof window.requestIdleCallback === 'function') {
    warmupIdleId = window.requestIdleCallback(run, { timeout: 8000 });
  } else {
    warmupTimeoutId = setTimeout(run, 5000);
  }
}

async function warmGalleryScopes(): Promise<void> {
  for (const scope of GALLERY_WARMUP_SCOPES) {
    try {
      await ensureGalleryBootstrap(defaultGalleryFeedQuery(scope));
    } catch {
      // Фоновый прогрев не блокирует UI.
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
}
