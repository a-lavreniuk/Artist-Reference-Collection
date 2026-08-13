import { BrowserWindow, clipboard, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { readdir, stat, unlink } from 'fs/promises';
import {
  captureNavigationEpoch,
  enterListCardsHandler,
  exitListCardsHandler,
  isNavigationEpochStale,
  yieldForNavigationIpc
} from './ipcNavigationPriority';
import { consumeDestructiveConfirm } from './destructiveConfirm';
import {
  addSkippedDuplicatePair,
  countCards,
  countCardsWithAnyTagIds,
  deleteCardFromStorage,
  restoreCardFromStorage,
  getCardByIdIsolated,
  softDeleteCardFromStorage,
  deleteCategoryFromDb,
  deleteCollectionFromDb,
  deleteTagFromDb,
  ensureLibraryReady,
  isLibraryRootReady,
  getCardByIdFromDb,
  getCardsWithPhash,
  getCollectionCardCounts,
  getCollectionPreviewSlicesFromDb,
  getCollectionStats,
  getMoodboardData,
  getSystemData,
  importMediaFile,
  insertCardMetadata,
  listAllTags,
  listCardsFromDb,
  listCollections,
  listFilterPresets,
  listCategories,
  listCategoriesWithVisibility,
  listSkippedDuplicatePairs,
  listTagsByCategory,
  mergeTagsInStorage,
  undoMergeTagsInStorage,
  deleteTagsInStorage,
  undoDeleteTagsInStorage,
  rebuildIndexFromCardJson,
  rowToCardRecord,
  saveMoodboardData,
  saveSystemData,
  setMigrationProgressCallback,
  updateCardInStorage,
  upsertCategory,
  upsertCollection,
  upsertFilterPreset,
  deleteFilterPreset,
  renameFilterPreset,
  FilterStatsAborted,
  getGalleryFilterStatsAsync,
  backfillVideoDurationMs,
  upsertTag,
  setVideoPreviewFrame,
  saveVideoFrameToCardFolder,
  copyVideoFrameToClipboard,
  ensureCardMediaMeta
} from './storage/libraryStorage';
import {
  buildGalleryFilterStatsCacheKey,
  getCachedGalleryFilterStats,
  setCachedGalleryFilterStats
} from './storage/galleryFilterStatsCache';
import { backfillPalettesBatch, searchCardsByColor } from './storage/colorSearch';
import { readCardJson } from './storage/cardFolder';
import { getCardDisplayPaletteRows, normalizeHex } from './storage/palette';
import {
  CARDS_DIR,
  LIBRARY_META_DIR
} from './libraryFilenames';
import type { ArcMoodboardV1, ArcSystemV1, CardJsonV1, CategoryRow, CollectionRow, ListCardsParams, LibraryScope, TagRow } from './storage/types';
import type { DeleteTagsUndo, MergeTagsTargetMetadata, MergeTagsUndo } from './storage/libraryStorage';
import { readLibraryRootSync } from './libraryRootConfig';
import { listLibrariesFromConfig } from './multiLibrary';
import { syncArcMediaServerLibraryRoots } from './media/mediaServerHost';
import {
  countSharedTrashCards,
  emptySharedTrash,
  findCardAcrossLibraries,
  listSharedTrashCards,
  permanentDeleteSharedTrashCard,
  resolveLibrarySource,
  restoreSharedTrashCard,
  type LibraryTrashSource
} from './storage/sharedTrash';

const MAX_LIST_CARDS_SYNC_LIMIT = 500;

function sanitizeListCardsParams(params: unknown): ListCardsParams {
  const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
  const offset = typeof p.offset === 'number' && p.offset >= 0 ? Math.floor(p.offset) : 0;
  const rawLimit = typeof p.limit === 'number' && p.limit > 0 ? Math.floor(p.limit) : 50;
  const limit = Math.min(rawLimit, MAX_LIST_CARDS_SYNC_LIMIT);
  const libraryScope: LibraryScope =
    p.libraryScope === 'untagged' || p.libraryScope === 'trash' ? p.libraryScope : 'all';
  return {
    offset,
    limit,
    libraryScope,
    selectedTagIds: Array.isArray(p.selectedTagIds)
      ? p.selectedTagIds.filter((x): x is string => typeof x === 'string')
      : undefined,
    cardIdExact: typeof p.cardIdExact === 'string' ? p.cardIdExact : null,
    collectionId: typeof p.collectionId === 'string' ? p.collectionId : null,
    moodboardCardIds: Array.isArray(p.moodboardCardIds)
      ? p.moodboardCardIds.filter((x): x is string => typeof x === 'string')
      : null,
    advancedFilters:
      p.advancedFilters && typeof p.advancedFilters === 'object'
        ? (p.advancedFilters as ListCardsParams['advancedFilters'])
        : undefined,
    sort:
      p.sort && typeof p.sort === 'object' ? (p.sort as ListCardsParams['sort']) : undefined
  };
}

let storageIpcRegistered = false;

function containerLibraries(fallbackRoot?: string | null): LibraryTrashSource[] {
  try {
    const listed = listLibrariesFromConfig().map((lib) => ({
      id: lib.id,
      name: lib.name,
      path: lib.path
    }));
    if (listed.length > 0) return listed;
  } catch {
    /* config best-effort */
  }
  if (!fallbackRoot) return [];
  return [{ id: 'active', name: path.basename(fallbackRoot), path: fallbackRoot }];
}

function syncMediaRootsFromLibraries(libraries: readonly LibraryTrashSource[]): void {
  const roots: Record<string, string> = {};
  for (const lib of libraries) roots[lib.id] = lib.path;
  syncArcMediaServerLibraryRoots(roots);
}

function parseCardScopedPayload(payload: unknown): {
  cardId: string | null;
  libraryId?: string;
  destinationLibraryId?: string;
  sourceLibraryRoot?: string;
  confirmToken?: unknown;
} {
  if (typeof payload === 'string') {
    return { cardId: payload };
  }
  if (!payload || typeof payload !== 'object') {
    return { cardId: null };
  }
  const body = payload as Record<string, unknown>;
  return {
    cardId: typeof body.cardId === 'string' ? body.cardId : typeof body.id === 'string' ? body.id : null,
    libraryId: typeof body.libraryId === 'string' ? body.libraryId : undefined,
    destinationLibraryId: typeof body.destinationLibraryId === 'string' ? body.destinationLibraryId : undefined,
    sourceLibraryRoot: typeof body.sourceLibraryRoot === 'string' ? body.sourceLibraryRoot : undefined,
    confirmToken: body.confirmToken
  };
}

function libraryMetaOf(lib: LibraryTrashSource): {
  libraryId: string;
  libraryName: string;
  libraryRoot: string;
} {
  return { libraryId: lib.id, libraryName: lib.name, libraryRoot: lib.path };
}

function queryListCards(root: string, p: ListCardsParams): ReturnType<typeof cardIndexToRenderer>[] {
  if (p.libraryScope === 'trash') {
    const libraries = containerLibraries(root);
    syncMediaRootsFromLibraries(libraries);
    return listSharedTrashCards(libraries, p).map((r) =>
      cardIndexToRenderer(rowToCardRecord(r), {
        libraryId: r.libraryId,
        libraryName: r.libraryName,
        libraryRoot: r.libraryRoot
      })
    );
  }
  return listCardsFromDb(root, p).map((r) => cardIndexToRenderer(rowToCardRecord(r)));
}

function broadcastImportProgress(payload: {
  current: number;
  total: number;
  message?: string;
  etaMs?: number | null;
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:import-files-progress', payload);
    }
  }
}

/** Активный ручной импорт: отмена после текущего файла. */
let activeImportAbort: AbortController | null = null;

function cardIndexToRenderer(
  row: ReturnType<typeof rowToCardRecord>,
  library?: { libraryId: string; libraryName: string; libraryRoot: string }
) {
  return {
    id: row.id,
    type: row.type,
    addedAt: row.addedAt,
    dateModified: row.dateModified,
    originalRelativePath: row.originalRel,
    thumbRelativePath: row.thumbSRel,
    thumbSRelativePath: row.thumbSRel,
    thumbMRelativePath: row.thumbMRel,
    thumbLRelativePath: row.thumbLRel,
    dominantColorHex: row.dominantColor,
    format: row.format,
    width: row.width,
    height: row.height,
    fileSize: row.fileSize,
    fileSizeMb: row.fileSize ? row.fileSize / (1024 * 1024) : undefined,
    tagIds: row.tagIds,
    collectionIds: row.collectionIds,
    description: row.description,
    aiCaption: row.aiCaption,
    name: row.name,
    linkUrl: row.linkUrl,
    durationMs: row.durationMs,
    rating: row.rating ?? 0,
    ...(library
      ? {
          libraryId: library.libraryId,
          libraryName: library.libraryName,
          libraryRoot: library.libraryRoot
        }
      : {})
  };
}

function enrichCardFromJson<T extends Record<string, unknown>>(
  base: T,
  cardJson: CardJsonV1 | null
): T & {
  fileCreatedAt?: string;
  name?: string;
  linkUrl?: string;
  videoWidth?: number;
  videoHeight?: number;
  previewFrameMs?: number;
  mediaMeta?: CardJsonV1['mediaMeta'];
} {
  if (!cardJson) return base;
  return {
    ...base,
    ...(cardJson.fileCreatedAt ? { fileCreatedAt: cardJson.fileCreatedAt } : {}),
    ...(cardJson.name ? { name: cardJson.name } : {}),
    ...(cardJson.linkUrl ? { linkUrl: cardJson.linkUrl } : {}),
    ...(typeof cardJson.videoWidth === 'number' ? { videoWidth: cardJson.videoWidth } : {}),
    ...(typeof cardJson.videoHeight === 'number' ? { videoHeight: cardJson.videoHeight } : {}),
    ...(typeof cardJson.previewFrameMs === 'number' ? { previewFrameMs: cardJson.previewFrameMs } : {}),
    ...(cardJson.mediaMeta ? { mediaMeta: cardJson.mediaMeta } : {})
  };
}

async function walkCardsRelativeFiles(rootAbs: string): Promise<string[]> {
  const out: string[] = [];
  const cardsRoot = path.join(rootAbs, CARDS_DIR);
  async function walkCardDir(cardId: string): Promise<void> {
    const base = path.join(cardsRoot, cardId);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.isFile()) {
        out.push(`${CARDS_DIR}/${cardId}/${ent.name}`.replace(/\\/g, '/'));
      }
    }
  }
  let cardIds: string[];
  try {
    cardIds = await readdir(cardsRoot);
  } catch {
    return out;
  }
  for (const id of cardIds) {
    await walkCardDir(id);
  }
  return out;
}

const ALLOWED_ROOT_DIR_NAMES = new Set([CARDS_DIR, LIBRARY_META_DIR, 'media']);

function isStructuralCardFile(rel: string): boolean {
  return /^cards\/[^/]+\/card\.json$/i.test(rel.replace(/\\/g, '/'));
}

async function walkLegacyMediaRelativeFiles(rootAbs: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(sub: string): Promise<void> {
    const base = path.join(rootAbs, ...sub.split('/').filter(Boolean));
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const relJoin = sub ? `${sub}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(relJoin);
      } else if (ent.isFile()) {
        out.push(relJoin.replace(/\\/g, '/'));
      }
    }
  }
  await walk('media');
  return out;
}

export function registerStorageIpc(
  readLibraryRoot: () => Promise<string | null>,
  assertNotMaintenance: () => void
): void {
  if (storageIpcRegistered) return;
  storageIpcRegistered = true;

  setMigrationProgressCallback((p) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('arc:migration-progress', p);
      }
    }
  });

  ipcMain.handle('arc:storage-ensure-ready', async () => {
    const root = await readLibraryRoot();
    if (!root) return { ok: false as const, error: 'Библиотека не выбрана' };
    await ensureLibraryReady(root);
    const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
    void refreshLibrarySessionSnapshotFromDisk();
    try {
      listCardsFromDb(root, { offset: 0, limit: 1, libraryScope: 'all' });
    } catch {
      /* прогрев SQLite на main */
    }
    return { ok: true as const };
  });

  ipcMain.on('arc:import-files-abort', () => {
    activeImportAbort?.abort();
  });

  ipcMain.handle('arc:import-files', async (_e, absolutePaths: unknown) => {
    assertNotMaintenance();
    if (!Array.isArray(absolutePaths) || !absolutePaths.every((x) => typeof x === 'string')) {
      throw new Error('Неверный список файлов');
    }
    if (activeImportAbort) {
      throw new Error('Импорт уже выполняется');
    }
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await ensureLibraryReady(root);
    const paths = absolutePaths as string[];
    const { allowMediaStagingPaths } = await import('./media/mediaStagingTokens');
    allowMediaStagingPaths(paths);

    const { runImportFilesBatch } = await import('./importFilesBatch');
    const {
      deferCardsForImportIndexing,
      setManualImportActive
    } = await import('./importIndexingDefer');
    const abort = new AbortController();
    activeImportAbort = abort;
    setManualImportActive(true);
    try {
      const outcome = await runImportFilesBatch({
        paths,
        signal: abort.signal,
        importOne: (absolutePath) => importMediaFile(root, absolutePath),
        onProgress: (payload) => broadcastImportProgress(payload)
      });

      const importedIds: string[] = [];
      for (const result of outcome.results) {
        if (result.ok) importedIds.push(result.row.id);
      }
      if (importedIds.length > 0) {
        deferCardsForImportIndexing(importedIds);
        const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
        void refreshLibrarySessionSnapshotFromDisk();
        const { triggerDuplicateScanAfterImport } = await import('./ipcDuplicates');
        void triggerDuplicateScanAfterImport();
      }
      return outcome;
    } finally {
      if (activeImportAbort === abort) activeImportAbort = null;
      setManualImportActive(false);
    }
  });

  ipcMain.on('arc:import-queue-idle', () => {
    void import('./importIndexingDefer').then(({ scheduleDeferredImportIndexingAfterQueueIdle }) => {
      scheduleDeferredImportIndexingAfterQueueIdle();
    });
  });

  ipcMain.on('arc:storage-list-cards-sync', (event, params: unknown) => {
    enterListCardsHandler();
    try {
      const p = sanitizeListCardsParams(params);
      const root = readLibraryRootSync();
      if (!root || !isLibraryRootReady(root)) {
        event.returnValue = [];
        return;
      }
      event.returnValue = queryListCards(root, p);
    } finally {
      exitListCardsHandler();
    }
  });

  ipcMain.handle('arc:storage-get-card', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    const scoped = typeof payload === 'string' ? { cardId: payload } : parseCardScopedPayload(payload);
    if (!root || !scoped.cardId) return null;
    const libraries = containerLibraries(root);
    const origin = resolveLibrarySource(libraries, scoped.libraryId);
    if (origin) {
      const row = getCardByIdIsolated(origin.path, scoped.cardId);
      if (row) {
        const base = cardIndexToRenderer(rowToCardRecord(row), libraryMetaOf(origin));
        const cardJson = await readCardJson(origin.path, scoped.cardId);
        return enrichCardFromJson(base, cardJson);
      }
    }
    await ensureLibraryReady(root);
    const row = getCardByIdFromDb(root, scoped.cardId);
    if (row) {
      const base = cardIndexToRenderer(rowToCardRecord(row));
      const cardJson = await readCardJson(root, scoped.cardId);
      return enrichCardFromJson(base, cardJson);
    }
    const found = findCardAcrossLibraries(libraries, scoped.cardId);
    if (!found) return null;
    const base = cardIndexToRenderer(rowToCardRecord(found.row), libraryMetaOf(found.library));
    const cardJson = await readCardJson(found.library.path, scoped.cardId);
    return enrichCardFromJson(base, cardJson);
  });

  ipcMain.handle('arc:storage-ensure-card-media-meta', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    const scoped = typeof payload === 'string' ? { cardId: payload } : parseCardScopedPayload(payload);
    if (!root || !scoped.cardId) return null;
    const libraries = containerLibraries(root);
    const origin =
      resolveLibrarySource(libraries, scoped.libraryId) ??
      findCardAcrossLibraries(libraries, scoped.cardId)?.library ??
      null;
    const cardRoot = origin?.path ?? root;
    await ensureLibraryReady(cardRoot);
    const row = origin
      ? getCardByIdIsolated(cardRoot, scoped.cardId)
      : getCardByIdFromDb(cardRoot, scoped.cardId);
    if (!row) return null;
    const cardJson = await ensureCardMediaMeta(cardRoot, scoped.cardId);
    const base = cardIndexToRenderer(
      rowToCardRecord(row),
      origin ? libraryMetaOf(origin) : undefined
    );
    return enrichCardFromJson(base, cardJson);
  });

  ipcMain.handle('arc:set-video-preview-frame', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не открыта');
    const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const cardId = typeof p.cardId === 'string' ? p.cardId : '';
    const frameMs = typeof p.frameMs === 'number' && Number.isFinite(p.frameMs) ? p.frameMs : NaN;
    if (!cardId || !Number.isFinite(frameMs)) throw new Error('Некорректные параметры');
    await ensureLibraryReady(root);
    const row = await setVideoPreviewFrame(root, cardId, frameMs);
    const base = cardIndexToRenderer(rowToCardRecord(row));
    const cardJson = await readCardJson(root, cardId);
    return enrichCardFromJson(base, cardJson);
  });

  ipcMain.handle('arc:save-video-frame-to-card-folder', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не открыта');
    const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const cardId = typeof p.cardId === 'string' ? p.cardId : '';
    const frameMs = typeof p.frameMs === 'number' && Number.isFinite(p.frameMs) ? p.frameMs : NaN;
    if (!cardId || !Number.isFinite(frameMs)) throw new Error('Некорректные параметры');
    await ensureLibraryReady(root);
    return saveVideoFrameToCardFolder(root, cardId, frameMs);
  });

  ipcMain.handle('arc:copy-video-frame-to-clipboard', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не открыта');
    const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const cardId = typeof p.cardId === 'string' ? p.cardId : '';
    const frameMs = typeof p.frameMs === 'number' && Number.isFinite(p.frameMs) ? p.frameMs : NaN;
    if (!cardId || !Number.isFinite(frameMs)) throw new Error('Некорректные параметры');
    await ensureLibraryReady(root);
    await copyVideoFrameToClipboard(root, cardId, frameMs, (imagePath) => {
      const image = nativeImage.createFromPath(imagePath);
      if (!image.isEmpty()) clipboard.writeImage(image);
      else throw new Error('Не удалось создать изображение кадра');
    });
    return { ok: true as const };
  });

  ipcMain.handle('arc:storage-get-card-display-palette', async (_e, cardId: unknown) => {
    const root = await readLibraryRoot();
    if (!root || typeof cardId !== 'string') return [];
    await ensureLibraryReady(root);
    const row = getCardByIdFromDb(root, cardId);
    if (!row) return [];
    return getCardDisplayPaletteRows(root, row);
  });

  ipcMain.handle('arc:storage-update-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    if (!payload || typeof payload !== 'object') throw new Error('Неверные данные');
    const raw = payload as { cardId?: unknown; patch?: unknown };
    if (typeof raw.cardId !== 'string' || !raw.cardId.trim()) throw new Error('Неверные данные');
    if (!raw.patch || typeof raw.patch !== 'object') throw new Error('Неверные данные');
    const p = raw as {
      cardId: string;
      patch: {
        tagIds?: string[];
        collectionIds?: string[];
        description?: string;
        name?: string;
        linkUrl?: string;
        rating?: number;
      };
    };
    await updateCardInStorage(root, p.cardId, p.patch);
  });

  ipcMain.handle('arc:storage-insert-cards-metadata', async (_e, cards: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    if (!Array.isArray(cards)) throw new Error('Неверные данные');
    await insertCardMetadata(root, cards as Parameters<typeof insertCardMetadata>[1]);
  });

  ipcMain.handle('arc:storage-soft-delete-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    const scoped = typeof payload === 'string' ? { cardId: payload } : parseCardScopedPayload(payload);
    if (!root || !scoped.cardId) return;
    const origin = resolveLibrarySource(containerLibraries(root), scoped.libraryId);
    const { withPreservedActiveDb } = await import('./storage/db');
    await withPreservedActiveDb(async () => {
      await softDeleteCardFromStorage(origin?.path ?? root, scoped.cardId as string);
    });
  });

  ipcMain.handle('arc:storage-restore-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    const scoped = typeof payload === 'string' ? { cardId: payload } : parseCardScopedPayload(payload);
    if (!root || !scoped.cardId) return { ok: false as const, error: 'Карточка не найдена' };
    if (!scoped.libraryId && !scoped.destinationLibraryId) {
      await restoreCardFromStorage(root, scoped.cardId);
      return { ok: true as const };
    }
    return restoreSharedTrashCard({
      cardId: scoped.cardId,
      libraryId: scoped.libraryId,
      destinationLibraryId: scoped.destinationLibraryId,
      sourceLibraryRoot: scoped.sourceLibraryRoot,
      libraries: containerLibraries(root)
    });
  });

  ipcMain.handle('arc:storage-permanent-delete-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const scoped = parseCardScopedPayload(payload);
    const cardId = scoped.cardId;
    if (!cardId) return;
    const binding = scoped.libraryId ? `${scoped.libraryId}:${cardId}` : cardId;
    if (!consumeDestructiveConfirm(scoped.confirmToken, 'permanent-delete-card', binding)) {
      throw new Error('Нужно подтверждение удаления');
    }
    const root = await readLibraryRoot();
    if (!root) return;
    if (scoped.libraryId) {
      await permanentDeleteSharedTrashCard(containerLibraries(root), cardId, scoped.libraryId);
    } else {
      await deleteCardFromStorage(root, cardId);
    }
    try {
      const { appendHistory } = await import('./libraryHistory');
      await appendHistory(root, 'Карточка удалена навсегда');
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle('arc:storage-empty-trash', async (_e, confirmToken: unknown) => {
    assertNotMaintenance();
    if (!consumeDestructiveConfirm(confirmToken, 'empty-trash')) {
      throw new Error('Нужно подтверждение очистки корзины');
    }
    const root = await readLibraryRoot();
    if (!root) return 0;
    await ensureLibraryReady(root);
    const n = await emptySharedTrash(containerLibraries(root));
    if (n > 0) {
      try {
        const { appendHistory } = await import('./libraryHistory');
        await appendHistory(root, `Очищена корзина: удалено ${n}`);
      } catch {
        /* ignore */
      }
    }
    return n;
  });

  ipcMain.handle('arc:storage-gallery-filter-stats', async (_e, payload: unknown) => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return null;
    const p = (payload ?? {}) as {
      libraryScope?: string;
      selectedTagIds?: string[];
      cardIdExact?: string | null;
      collectionId?: string | null;
      moodboardCardIds?: string[] | null;
    };
    const scope: LibraryScope =
      p.libraryScope === 'untagged' || p.libraryScope === 'trash' ? p.libraryScope : 'all';
    const opts = {
      libraryScope: scope,
      selectedTagIds: Array.isArray(p.selectedTagIds) ? p.selectedTagIds : [],
      cardIdExact: typeof p.cardIdExact === 'string' ? p.cardIdExact : null,
      collectionId: typeof p.collectionId === 'string' ? p.collectionId : null,
      moodboardCardIds: Array.isArray(p.moodboardCardIds) ? p.moodboardCardIds : null
    };
    const cacheKey = buildGalleryFilterStatsCacheKey(opts);
    const cached = getCachedGalleryFilterStats(root, cacheKey);
    if (cached) return cached;

    await ensureLibraryReady(root);
    const navSnap = captureNavigationEpoch();
    try {
      const stats = await getGalleryFilterStatsAsync(root, opts, () => isNavigationEpochStale(navSnap));
      setCachedGalleryFilterStats(root, cacheKey, stats);
      return stats;
    } catch (err) {
      if (err instanceof FilterStatsAborted) {
        return getCachedGalleryFilterStats(root, cacheKey);
      }
      throw err;
    }
  });

  ipcMain.handle('arc:storage-list-filter-presets', async () => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return listFilterPresets(root);
  });

  ipcMain.handle('arc:storage-upsert-filter-preset', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    const p = payload as { id: string; name: string; payload: unknown };
    upsertFilterPreset(root, p.id, p.name, p.payload as import('./storage/galleryFilters').GalleryFilterPresetPayload);
  });

  ipcMain.handle('arc:storage-delete-filter-preset', async (_e, id: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof id !== 'string') return;
    deleteFilterPreset(root, id);
  });

  ipcMain.handle('arc:storage-rename-filter-preset', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) return;
    const p = payload as { id: string; name: string };
    if (!p?.id || !p?.name) return;
    renameFilterPreset(root, p.id, p.name);
  });

  ipcMain.handle('arc:storage-backfill-duration', async () => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) return { updated: 0, failed: 0 };
    await ensureLibraryReady(root);
    return backfillVideoDurationMs(root);
  });

  ipcMain.handle('arc:storage-count-cards', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return 0;
    await ensureLibraryReady(root);
    const p =
      typeof payload === 'string'
        ? { filter: payload }
        : (payload as { filter?: string; libraryScope?: string } | null) ?? {};
    const f = p.filter === 'images' || p.filter === 'videos' ? p.filter : 'all';
    const scope =
      p.libraryScope === 'untagged' || p.libraryScope === 'trash' ? p.libraryScope : 'all';
    if (scope === 'trash') {
      return countSharedTrashCards(containerLibraries(root), f);
    }
    return countCards(root, f, scope);
  });

  ipcMain.handle('arc:storage-count-cards-with-tag-ids', async (_e, tagIds: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return 0;
    if (!Array.isArray(tagIds) || !tagIds.every((x) => typeof x === 'string')) return 0;
    await ensureLibraryReady(root);
    return countCardsWithAnyTagIds(root, tagIds as string[]);
  });

  ipcMain.handle('arc:storage-list-categories', async () => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    const { getActiveLibraryEntry, readLibraryRootConfigSync } = await import('./librarySessionSnapshot');
    const activeId = getActiveLibraryEntry(readLibraryRootConfigSync())?.id ?? null;
    return listCategoriesWithVisibility(activeId);
  });

  ipcMain.handle('arc:storage-upsert-category', async (_e, cat: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    upsertCategory(root, cat as CategoryRow);
  });

  ipcMain.handle(
    'arc:storage-preview-category-visibility-change',
    async (
      _e,
      payload: unknown
    ): Promise<{ cardsAffected: number; libraryIdsLosing: string[] }> => {
      const body = payload as {
        categoryId?: string;
        visibilityMode?: 'all' | 'libraries';
        visibilityLibraryIds?: string[];
      } | null;
      if (!body?.categoryId) return { cardsAffected: 0, libraryIdsLosing: [] };
      const { listCatalogTagsByCategory, libraryIdsWithCategoryVisibility } = await import(
        './storage/tagCatalog'
      );
      const { readLibraryRootConfigSync } = await import('./librarySessionSnapshot');
      const { countCardsWithTagIdsInLibraries } = await import('./storage/libraryStorage');
      const cfg = readLibraryRootConfigSync();
      const libs = cfg.libraries ?? [];
      const before = new Set(libraryIdsWithCategoryVisibility(body.categoryId, libs));
      const after =
        body.visibilityMode === 'libraries'
          ? new Set(body.visibilityLibraryIds ?? [])
          : new Set(libs.map((l) => l.id));
      const losing = [...before].filter((id) => !after.has(id));
      const tagIds = listCatalogTagsByCategory(body.categoryId).map((t) => t.id);
      const cardsAffected = countCardsWithTagIdsInLibraries(tagIds, losing);
      return { cardsAffected, libraryIdsLosing: losing };
    }
  );

  ipcMain.handle(
    'arc:storage-apply-category-visibility',
    async (
      _e,
      payload: unknown
    ): Promise<{ ok: true; stripped: number } | { ok: false; error: string }> => {
      assertNotMaintenance();
      const body = payload as {
        categoryId?: string;
        visibilityMode?: 'all' | 'libraries';
        visibilityLibraryIds?: string[];
        category?: CategoryRow;
      } | null;
      if (!body?.categoryId || !body.category) {
        return { ok: false, error: 'Некорректные параметры' };
      }
      const root = await readLibraryRoot();
      if (!root) return { ok: false, error: 'Библиотека не выбрана' };

      const { libraryIdsWithCategoryVisibility } = await import('./storage/tagCatalog');
      const { readLibraryRootConfigSync } = await import('./librarySessionSnapshot');
      const {
        stripTagsOfCategoryFromLibraries,
        upsertCategory: upsertCat
      } = await import('./storage/libraryStorage');
      const cfg = readLibraryRootConfigSync();
      const libs = cfg.libraries ?? [];
      const before = new Set(libraryIdsWithCategoryVisibility(body.categoryId, libs));
      const mode = body.visibilityMode === 'libraries' ? 'libraries' : 'all';
      const after =
        mode === 'libraries' ? new Set(body.visibilityLibraryIds ?? []) : new Set(libs.map((l) => l.id));
      const losing = [...before].filter((id) => !after.has(id));

      if (mode === 'libraries' && (body.visibilityLibraryIds?.length ?? 0) === 0) {
        return { ok: false, error: 'Выберите хотя бы одну библиотеку' };
      }

      let stripped = 0;
      if (losing.length > 0) {
        stripped = await stripTagsOfCategoryFromLibraries(body.categoryId, losing);
      }

      upsertCat(root, {
        ...body.category,
        visibilityMode: mode,
        visibilityLibraryIds: mode === 'libraries' ? (body.visibilityLibraryIds ?? []) : []
      });
      return { ok: true, stripped };
    }
  );

  ipcMain.handle('arc:storage-delete-category', async (_e, id: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof id !== 'string') return;
    await deleteCategoryFromDb(root, id);
  });

  ipcMain.handle('arc:storage-list-tags-by-category', async (_e, categoryId: unknown) => {
    const root = await readLibraryRoot();
    if (!root || typeof categoryId !== 'string') return [];
    await ensureLibraryReady(root);
    return listTagsByCategory(root, categoryId);
  });

  ipcMain.handle('arc:storage-list-all-tags', async () => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return listAllTags(root);
  });

  ipcMain.handle('arc:storage-upsert-tag', async (_e, tag: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    upsertTag(root, tag as TagRow);
  });

  ipcMain.handle('arc:storage-delete-tag', async (_e, tagId: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof tagId !== 'string') return;
    await deleteTagFromDb(root, tagId);
  });

  ipcMain.handle('arc:storage-merge-tags', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await ensureLibraryReady(root);
    const input = payload as {
      targetTagId: string;
      sourceTagIds: string[];
      targetMetadata: MergeTagsTargetMetadata;
    };
    return mergeTagsInStorage(input);
  });

  ipcMain.handle('arc:storage-undo-merge-tags', async (_e, undo: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await undoMergeTagsInStorage(undo as MergeTagsUndo);
  });

  ipcMain.handle('arc:storage-delete-tags', async (_e, tagIds: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await ensureLibraryReady(root);
    if (!Array.isArray(tagIds)) throw new Error('Не переданы метки для удаления');
    return deleteTagsInStorage(tagIds.filter((id): id is string => typeof id === 'string'));
  });

  ipcMain.handle('arc:storage-undo-delete-tags', async (_e, undo: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await undoDeleteTagsInStorage(undo as DeleteTagsUndo);
  });

  ipcMain.handle('arc:storage-list-collections', async () => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return listCollections(root);
  });

  ipcMain.handle('arc:storage-upsert-collection', async (_e, col: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    upsertCollection(root, col as CollectionRow);
  });

  ipcMain.handle('arc:storage-delete-collection', async (_e, id: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof id !== 'string') return;
    await deleteCollectionFromDb(root, id);
  });

  ipcMain.handle('arc:storage-collection-counts', async () => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return {};
    await ensureLibraryReady(root);
    return getCollectionCardCounts(root);
  });

  ipcMain.handle('arc:storage-collection-preview-slices', async (_e, limit: unknown) => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return {};
    await ensureLibraryReady(root);
    const n = typeof limit === 'number' && limit > 0 ? limit : 3;
    const slices = getCollectionPreviewSlicesFromDb(root, n);
    const out: Record<string, ReturnType<typeof cardIndexToRenderer>[]> = {};
    for (const [colId, rows] of Object.entries(slices)) {
      out[colId] = rows.map((r) => cardIndexToRenderer(rowToCardRecord(r)));
    }
    return out;
  });

  ipcMain.handle('arc:storage-collections-sidebar', async (_e, payload: unknown) => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return { collections: [], counts: {}, previews: {} };
    await ensureLibraryReady(root);
    const previewLimitRaw =
      payload && typeof payload === 'object' && 'previewLimit' in payload
        ? (payload as { previewLimit?: unknown }).previewLimit
        : 0;
    const previewLimit = typeof previewLimitRaw === 'number' && previewLimitRaw > 0 ? previewLimitRaw : 0;
    const collections = listCollections(root);
    const counts = getCollectionCardCounts(root);
    let previews: Record<string, ReturnType<typeof cardIndexToRenderer>[]> = {};
    if (previewLimit > 0) {
      const slices = getCollectionPreviewSlicesFromDb(root, previewLimit);
      for (const [colId, rows] of Object.entries(slices)) {
        previews[colId] = rows.map((r) => cardIndexToRenderer(rowToCardRecord(r)));
      }
    }
    return { collections, counts, previews };
  });

  ipcMain.handle('arc:storage-collection-stats', async (_e, collectionId: unknown) => {
    const root = await readLibraryRoot();
    if (!root || typeof collectionId !== 'string') return null;
    await ensureLibraryReady(root);
    return getCollectionStats(root, collectionId);
  });

  ipcMain.handle('arc:storage-get-moodboard', async () => {
    await yieldForNavigationIpc();
    const root = await readLibraryRoot();
    if (!root) return { version: 1, moodboardCardIds: [] };
    return getMoodboardData(root);
  });

  ipcMain.handle('arc:storage-save-moodboard', async (_e, data: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await saveMoodboardData(root, data as ArcMoodboardV1);
  });

  ipcMain.handle('arc:storage-get-system', async () => {
    const root = await readLibraryRoot();
    if (!root) return null;
    return getSystemData(root);
  });

  ipcMain.handle('arc:storage-save-system', async (_e, data: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await saveSystemData(root, data as ArcSystemV1);
  });

  ipcMain.handle('arc:storage-skipped-pairs', async () => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return listSkippedDuplicatePairs(root);
  });

  ipcMain.handle('arc:storage-add-skipped-pair', async (_e, idA: unknown, idB: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof idA !== 'string' || typeof idB !== 'string') return;
    addSkippedDuplicatePair(root, idA, idB);
  });

  ipcMain.handle('arc:storage-cards-phash', async () => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return getCardsWithPhash(root);
  });

  ipcMain.handle('arc:storage-rebuild-index', async () => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await rebuildIndexFromCardJson(root);
  });

  ipcMain.handle('arc:scan-library-orphan-files', async (_e, payload: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return { orphans: [] as string[] };

    let referencedPaths: string[] = [];
    let cardIds: string[] = [];
    if (Array.isArray(payload)) {
      referencedPaths = payload.filter((r): r is string => typeof r === 'string');
    } else if (payload && typeof payload === 'object') {
      const p = payload as { paths?: unknown; cardIds?: unknown; referencedPaths?: unknown };
      if (Array.isArray(p.paths)) {
        referencedPaths = p.paths.filter((r): r is string => typeof r === 'string');
      } else if (Array.isArray(p.referencedPaths)) {
        referencedPaths = p.referencedPaths.filter((r): r is string => typeof r === 'string');
      }
      if (Array.isArray(p.cardIds)) {
        cardIds = p.cardIds.filter((id): id is string => typeof id === 'string');
      }
    } else {
      return { orphans: [] as string[] };
    }

    const referencedExact = new Set<string>();
    const referencedLower = new Set<string>();
    for (const r of referencedPaths) {
      if (!r.trim()) continue;
      const norm = r.replace(/\\/g, '/');
      referencedExact.add(norm);
      referencedLower.add(norm.toLowerCase());
    }

    const cardIdExact = new Set<string>();
    const cardIdLower = new Set<string>();
    for (const id of cardIds) {
      if (!id.trim()) continue;
      cardIdExact.add(id);
      cardIdLower.add(id.toLowerCase());
    }

    const isReferencedPath = (norm: string): boolean => {
      if (referencedExact.has(norm) || referencedLower.has(norm.toLowerCase())) return true;
      const m = /^cards\/([^/]+)\//i.exec(norm);
      if (!m) return false;
      const folderId = m[1]!;
      return cardIdExact.has(folderId) || cardIdLower.has(folderId.toLowerCase());
    };

    const diskRel = [
      ...(await walkCardsRelativeFiles(root)),
      ...(await walkLegacyMediaRelativeFiles(root))
    ];
    try {
      const top = await readdir(root, { withFileTypes: true });
      for (const ent of top) {
        if (!ent.isFile()) continue;
        diskRel.push(ent.name.replace(/\\/g, '/'));
      }
    } catch {
      /* skip */
    }
    const orphans = diskRel.filter((rel) => {
      const norm = rel.replace(/\\/g, '/');
      if (isStructuralCardFile(norm)) return false;
      if (norm === LIBRARY_META_DIR || norm.startsWith(`${LIBRARY_META_DIR}/`)) return false;
      return !isReferencedPath(norm);
    });
    orphans.sort((a, b) => a.localeCompare(b, 'en'));
    return { orphans };
  });

  ipcMain.handle('arc:delete-card-folder', async (_e, cardId: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof cardId !== 'string') return;
    const { deleteCardFolder } = await import('./storage/cardFolder');
    await deleteCardFolder(root, cardId);
  });

  ipcMain.handle('arc:color-search-cards', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    const p = payload as Partial<ListCardsParams> & { hex?: string; accuracy?: number; scopeCardIds?: string[] };
    const hex = typeof p.hex === 'string' ? normalizeHex(p.hex) : '';
    if (!hex) return [];
    await backfillPalettesBatch(root, 64);
    const scope =
      Array.isArray(p.scopeCardIds) && p.scopeCardIds.length > 0 ? new Set(p.scopeCardIds) : null;
    const rows = searchCardsByColor(root, {
      hex,
      accuracy: typeof p.accuracy === 'number' ? p.accuracy : 85,
      libraryScope: p.libraryScope,
      selectedTagIds: p.selectedTagIds,
      cardIdExact: p.cardIdExact,
      collectionId: p.collectionId,
      moodboardCardIds: p.moodboardCardIds,
      advancedFilters: p.advancedFilters,
      sort: p.sort,
      scopeCardIds: scope,
      offset: typeof p.offset === 'number' ? p.offset : 0,
      limit: typeof p.limit === 'number' ? p.limit : 50
    });
    return rows.map((r) => cardIndexToRenderer(rowToCardRecord(r)));
  });
}

export { walkCardsRelativeFiles };
