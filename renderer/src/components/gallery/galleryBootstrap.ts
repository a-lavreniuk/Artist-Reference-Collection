import { listCardsPage } from '../../services/db';
import {
  buildGalleryQueryKey,
  defaultGalleryFeedQuery,
  GALLERY_PAGE_INITIAL,
  GALLERY_WARMUP_SCOPES,
  type GalleryFeedQuery
} from './galleryQuery';
import { mergeCardsSrcMap, peekCardsSrcMap, preloadDecodedImages } from './galleryMediaCache';
import { getGallerySnapshot, setGallerySnapshot } from './galleryScopeCache';

let bootPromise: Promise<void> | null = null;

async function loadFirstPageIntoCache(query: GalleryFeedQuery, preloadDecode: boolean): Promise<void> {
  const key = buildGalleryQueryKey(query);
  if (getGallerySnapshot(key)) return;

  const chunk = await listCardsPage({
    offset: 0,
    limit: GALLERY_PAGE_INITIAL,
    filter: query.filter,
    libraryScope: query.libraryScope,
    selectedTagIds: query.selectedTagIds,
    cardIdExact: query.cardIdExact
  });

  const peek = peekCardsSrcMap(chunk);
  const srcMap = await mergeCardsSrcMap(chunk, peek);
  const snapshot = {
    cards: chunk,
    srcMap,
    offset: chunk.length,
    hasMore: chunk.length === GALLERY_PAGE_INITIAL
  };
  setGallerySnapshot(key, snapshot);

  if (preloadDecode && chunk.length > 0) {
    await preloadDecodedImages(Object.values(srcMap));
  }
}

export function ensureGalleryBootstrap(query: GalleryFeedQuery = defaultGalleryFeedQuery()): Promise<void> {
  if (getGallerySnapshot(buildGalleryQueryKey(query))) {
    return Promise.resolve();
  }
  if (!bootPromise) {
    bootPromise = loadFirstPageIntoCache(query, true).finally(() => {
      bootPromise = null;
    });
  }
  return bootPromise;
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
    warmupIdleId = window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    warmupTimeoutId = setTimeout(run, 2000);
  }
}

async function warmGalleryScopes(): Promise<void> {
  for (const scope of GALLERY_WARMUP_SCOPES) {
    const query = defaultGalleryFeedQuery(scope);
    try {
      await loadFirstPageIntoCache(query, false);
    } catch {
      // Фоновый прогрев не блокирует UI.
    }
  }
}
