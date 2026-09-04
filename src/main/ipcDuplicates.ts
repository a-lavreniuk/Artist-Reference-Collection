import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';

import { consumeDestructiveConfirm } from './destructiveConfirm';
import {
  addSessionSkippedPair,
  checkImportDuplicates,
  FALLBACK_SCAN_LIBRARY_ID,
  getCachedDuplicatePairs,
  getDuplicateThresholdFromSystem,
  isExactDuplicateIncomingFile,
  probeIncomingFileMetadata,
  requestScanCancel,
  resetDuplicateScanSession,
  runDuplicateScan,
  scanDuplicatePairs,
  scanForDuplicateFilesAfterImport,
  type DuplicatePairDto,
  type DuplicateScanLibrary,
  type DuplicateScanScope
} from './duplicateScanService';
import { pairKey } from './duplicateMatch';
import { allowMediaStagingPaths } from './media/mediaStagingTokens';
import { listLibrariesFromConfig } from './multiLibrary';
import { withPreservedActiveDb } from './storage/db';
import {
  parseJsonColumn,
  sanitizeCardAnnotations,
  sanitizeCustomFieldsMap,
  defaultDetailCardTemplate,
  type DetailCardTemplateV1
} from './shared/detailCardTemplate';
import {
  addCrossSkippedPair,
  loadCrossSkippedPairKeys,
  resolveContainerPathForDuplicates
} from './storage/containerSkippedDuplicates';
import {
  addSkippedDuplicatePair,
  addSkippedDuplicatePairAtRoot,
  ensureLibraryReady,
  getCardByIdFromDb,
  getCardByIdIsolated,
  getLibraryDetailTemplateFromDb,
  listAllTags,
  listCategories,
  listCollections,
  listSkippedDuplicatePairsReadonly,
  mergeDuplicateCards,
  replaceCardOriginalFromFile,
  rowToCardRecord,
  softDeleteCardFromStorage
} from './storage/libraryStorage';

let ipcRegistered = false;
let duplicateScanRunInFlight = false;
const MAX_DUPLICATE_PAIRS_IPC = 2000;

export function duplicateScanEmptyResult(extra?: { cancelled?: boolean; busy?: boolean; thresholdPct?: number }) {
  return {
    pairs: [] as ReturnType<typeof enrichPairsWithCards>,
    thresholdPct: extra?.thresholdPct ?? 85,
    scannedCards: 0,
    totalCards: 0,
    duplicatesFound: 0,
    spaceSavedBytes: 0,
    cancelled: extra?.cancelled === true,
    busy: extra?.busy === true
  };
}

function cardIndexToRenderer(row: ReturnType<typeof rowToCardRecord>) {
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
    customFields: sanitizeCustomFieldsMap(parseJsonColumn(row.customFieldsJson, {})),
    annotations: sanitizeCardAnnotations(parseJsonColumn(row.annotationsJson, []))
  };
}

function previewAbsForRow(root: string, row: ReturnType<typeof rowToCardRecord>): string {
  const rel = row.thumbSRel || row.thumbMRel || row.thumbLRel || row.originalRel;
  return path.join(root, rel.replace(/\//g, path.sep));
}

function collectionsForRoot(
  root: string,
  cache: Map<string, ReturnType<typeof listCollections>>
): ReturnType<typeof listCollections> {
  const cached = cache.get(root);
  if (cached) return cached;
  let next: ReturnType<typeof listCollections> = [];
  try {
    next = listCollections(root);
  } catch {
    next = [];
  }
  cache.set(root, next);
  return next;
}

function enrichPairsWithCards(pairs: DuplicatePairDto[]) {
  const staging: string[] = [];
  const templateByRoot = new Map<string, DetailCardTemplateV1>();
  const collectionsByRoot = new Map<string, ReturnType<typeof listCollections>>();
  const catalogCategories = listCategories();
  const catalogTags = listAllTags().map((tag) => ({
    id: tag.id,
    categoryId: tag.categoryId,
    name: tag.name,
    usageCount: tag.usageCount,
    ...(tag.description ? { description: tag.description } : {}),
    ...(tag.tooltipImage ? { tooltipImageDataUrl: tag.tooltipImage } : {})
  }));
  const templateFor = (root: string): DetailCardTemplateV1 => {
    const cached = templateByRoot.get(root);
    if (cached) return cached;
    let next: DetailCardTemplateV1;
    try {
      next = getLibraryDetailTemplateFromDb(root);
    } catch {
      next = defaultDetailCardTemplate();
    }
    templateByRoot.set(root, next);
    return next;
  };
  const enriched = pairs.map((pair) => {
    const rootA = pair.libraryRootA;
    const rootB = pair.libraryRootB;
    const rowA = getCardByIdIsolated(rootA, pair.cardIdA);
    const rowB = getCardByIdIsolated(rootB, pair.cardIdB);
    const recA = rowA ? rowToCardRecord(rowA) : null;
    const recB = rowB ? rowToCardRecord(rowB) : null;
    const previewAbsA = recA ? previewAbsForRow(rootA, recA) : null;
    const previewAbsB = recB ? previewAbsForRow(rootB, recB) : null;
    if (previewAbsA) staging.push(previewAbsA);
    if (previewAbsB) staging.push(previewAbsB);
    if (recA) staging.push(path.join(rootA, recA.originalRel.replace(/\//g, path.sep)));
    if (recB) staging.push(path.join(rootB, recB.originalRel.replace(/\//g, path.sep)));
    return {
      ...pair,
      previewAbsA,
      previewAbsB,
      cardA: recA ? cardIndexToRenderer(recA) : null,
      cardB: recB ? cardIndexToRenderer(recB) : null,
      detailTemplateA: templateFor(rootA),
      detailTemplateB: templateFor(rootB),
      catalogCategories,
      catalogTags,
      collectionsA: collectionsForRoot(rootA, collectionsByRoot),
      collectionsB: collectionsForRoot(rootB, collectionsByRoot)
    };
  });
  allowMediaStagingPaths(staging);
  return enriched;
}

function parseScanScope(payload: unknown): DuplicateScanScope {
  if (!payload || typeof payload !== 'object') return { mode: 'current' };
  const p = payload as { scope?: unknown };
  if (!p.scope || typeof p.scope !== 'object') return { mode: 'current' };
  const s = p.scope as { mode?: unknown; libraryIds?: unknown };
  if (s.mode === 'all') return { mode: 'all' };
  if (s.mode === 'ids') {
    const ids = Array.isArray(s.libraryIds) ? s.libraryIds.filter((id): id is string => typeof id === 'string') : [];
    return { mode: 'ids', libraryIds: ids };
  }
  return { mode: 'current' };
}

function resolveScanLibraries(activeRoot: string, scope: DuplicateScanScope): DuplicateScanLibrary[] {
  const listed = listLibrariesFromConfig();
  const fallback: DuplicateScanLibrary = {
    id: listed.find((l) => path.resolve(l.path) === path.resolve(activeRoot))?.id ?? FALLBACK_SCAN_LIBRARY_ID,
    name: listed.find((l) => path.resolve(l.path) === path.resolve(activeRoot))?.name ?? path.basename(activeRoot),
    path: activeRoot
  };
  if (listed.length === 0) return [fallback];
  if (scope.mode === 'current') {
    const active = listed.find((l) => l.active) ?? listed.find((l) => path.resolve(l.path) === path.resolve(activeRoot));
    return active ? [{ id: active.id, name: active.name, path: active.path }] : [fallback];
  }
  if (scope.mode === 'ids') {
    const wanted = new Set(scope.libraryIds ?? []);
    const picked = listed.filter((l) => wanted.has(l.id)).map((l) => ({ id: l.id, name: l.name, path: l.path }));
    return picked.length > 0 ? picked : [fallback];
  }
  return listed.map((l) => ({ id: l.id, name: l.name, path: l.path }));
}

function resolveLibraryById(libraryId: string | undefined, fallbackRoot: string | null): DuplicateScanLibrary | null {
  const listed = listLibrariesFromConfig();
  if (libraryId) {
    const found = listed.find((l) => l.id === libraryId);
    if (found) return { id: found.id, name: found.name, path: found.path };
  }
  if (fallbackRoot) {
    const byPath = listed.find((l) => path.resolve(l.path) === path.resolve(fallbackRoot));
    if (byPath) return { id: byPath.id, name: byPath.name, path: byPath.path };
    return { id: FALLBACK_SCAN_LIBRARY_ID, name: path.basename(fallbackRoot), path: fallbackRoot };
  }
  const active = listed.find((l) => l.active) ?? listed[0];
  return active ? { id: active.id, name: active.name, path: active.path } : null;
}

function broadcastDuplicatesFound(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:duplicates-found', {});
    }
  }
}

export async function triggerDuplicateScanAfterImport(): Promise<void> {
  const found = await scanForDuplicateFilesAfterImport();
  if (found) broadcastDuplicatesFound();
}

function parseSkipSides(first: unknown, second?: unknown): {
  cardIdA: string;
  cardIdB: string;
  libraryIdA?: string;
  libraryIdB?: string;
} | null {
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    const p = first as Record<string, unknown>;
    if (typeof p.cardIdA === 'string' && typeof p.cardIdB === 'string') {
      return {
        cardIdA: p.cardIdA,
        cardIdB: p.cardIdB,
        libraryIdA: typeof p.libraryIdA === 'string' ? p.libraryIdA : undefined,
        libraryIdB: typeof p.libraryIdB === 'string' ? p.libraryIdB : undefined
      };
    }
  }
  if (typeof first === 'string' && typeof second === 'string') {
    return { cardIdA: first, cardIdB: second };
  }
  return null;
}

export function registerDuplicateIpc(
  readLibraryRoot: () => Promise<string | null>,
  assertNotMaintenance: () => void
): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:check-import-duplicates', async (_e, absolutePaths: unknown) => {
    assertNotMaintenance();
    if (!Array.isArray(absolutePaths) || !absolutePaths.every((x) => typeof x === 'string')) {
      return [];
    }
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    const paths = absolutePaths as string[];
    const { allowMediaStagingPaths: allow } = await import('./media/mediaStagingTokens');
    allow(paths);
    const matches = await checkImportDuplicates(root, paths);
    const out = [];
    for (const m of matches) {
      const row = getCardByIdFromDb(root, m.existingCardId);
      out.push({
        ...m,
        existingCard: row ? cardIndexToRenderer(rowToCardRecord(row)) : null
      });
    }
    return out;
  });

  ipcMain.handle('arc:check-exact-duplicate-file', async (_e, absolutePath: unknown) => {
    if (typeof absolutePath !== 'string') return false;
    const root = await readLibraryRoot();
    if (!root) return false;
    await ensureLibraryReady(root);
    const { allowMediaStagingPaths: allow } = await import('./media/mediaStagingTokens');
    allow([absolutePath]);
    return isExactDuplicateIncomingFile(root, absolutePath);
  });

  ipcMain.handle('arc:probe-incoming-file', async (_e, absolutePath: unknown) => {
    if (typeof absolutePath !== 'string') return null;
    const { allowMediaStagingPaths: allow } = await import('./media/mediaStagingTokens');
    allow([absolutePath]);
    return probeIncomingFileMetadata(absolutePath);
  });

  ipcMain.handle('arc:scan-duplicate-pairs', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) return { pairs: [], thresholdPct: 85 };
    await ensureLibraryReady(root);

    let thresholdPct = await getDuplicateThresholdFromSystem(root);
    let resetSession = false;
    if (payload && typeof payload === 'object') {
      const p = payload as { thresholdPct?: unknown; resetSession?: unknown };
      if (typeof p.thresholdPct === 'number') {
        thresholdPct = Math.min(100, Math.max(50, Math.round(p.thresholdPct)));
      }
      if (p.resetSession === true) resetSession = true;
    }
    if (resetSession) resetDuplicateScanSession();

    const pairs = await scanDuplicatePairs(root, thresholdPct);
    return { pairs: pairs.slice(0, MAX_DUPLICATE_PAIRS_IPC), thresholdPct };
  });

  ipcMain.handle('arc:duplicate-session-skip-pair', async (_e, first: unknown, second: unknown) => {
    const sides = parseSkipSides(first, second);
    if (!sides) return;
    addSessionSkippedPair(sides.cardIdA, sides.cardIdB, sides.libraryIdA, sides.libraryIdB);
  });

  ipcMain.handle('arc:duplicate-reset-scan-session', async () => {
    resetDuplicateScanSession();
  });

  ipcMain.handle('arc:duplicate-get-cached-pairs', async () => {
    return getCachedDuplicatePairs();
  });

  ipcMain.handle('arc:replace-card-original', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    if (!payload || typeof payload !== 'object') throw new Error('Неверные параметры');
    const p = payload as { cardId?: unknown; sourceAbs?: unknown };
    if (typeof p.cardId !== 'string' || typeof p.sourceAbs !== 'string') {
      throw new Error('Неверные параметры');
    }
    await ensureLibraryReady(root);
    await replaceCardOriginalFromFile(root, p.cardId, p.sourceAbs);
    const { queueCardsForIndexing } = await import('./ipcAi');
    void queueCardsForIndexing([p.cardId]);
    const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
    void refreshLibrarySessionSnapshotFromDisk();
  });

  ipcMain.handle('arc:merge-duplicate-cards', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const activeRoot = await readLibraryRoot();
    if (!payload || typeof payload !== 'object') throw new Error('Неверные параметры');
    const p = payload as { primaryId?: unknown; secondaryId?: unknown; libraryId?: unknown };
    if (typeof p.primaryId !== 'string' || typeof p.secondaryId !== 'string') {
      throw new Error('Неверные параметры');
    }
    const lib = resolveLibraryById(typeof p.libraryId === 'string' ? p.libraryId : undefined, activeRoot);
    if (!lib) throw new Error('Библиотека не выбрана');
    await withPreservedActiveDb(async () => {
      await ensureLibraryReady(lib.path);
      await mergeDuplicateCards(lib.path, p.primaryId as string, p.secondaryId as string);
    });
    const { queueCardsForIndexing } = await import('./ipcAi');
    void queueCardsForIndexing([p.primaryId as string]);
    const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
    void refreshLibrarySessionSnapshotFromDisk();
  });

  ipcMain.handle('arc:duplicate-soft-delete-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    if (!payload || typeof payload !== 'object') throw new Error('Неверные параметры');
    const p = payload as { cardId?: unknown; libraryId?: unknown; confirmToken?: unknown };
    if (typeof p.cardId !== 'string') throw new Error('Неверные параметры');
    const activeRoot = await readLibraryRoot();
    const lib = resolveLibraryById(typeof p.libraryId === 'string' ? p.libraryId : undefined, activeRoot);
    if (!lib) throw new Error('Библиотека не выбрана');
    const binding = `${lib.id}:${p.cardId}`;
    if (!consumeDestructiveConfirm(p.confirmToken, 'duplicate-delete-card', binding)) {
      throw new Error('Нужно подтверждение удаления');
    }
    await withPreservedActiveDb(async () => {
      await ensureLibraryReady(lib.path);
      await softDeleteCardFromStorage(lib.path, p.cardId as string);
    });
    const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
    void refreshLibrarySessionSnapshotFromDisk();
    return { ok: true as const };
  });

  ipcMain.handle('arc:duplicate-add-skipped-pair', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const sides = parseSkipSides(payload);
    if (!sides) return;
    const activeRoot = await readLibraryRoot();
    const libA = resolveLibraryById(sides.libraryIdA, activeRoot);
    const libB = resolveLibraryById(sides.libraryIdB ?? sides.libraryIdA, activeRoot);
    if (!libA || !libB) return;
    if (libA.id === libB.id) {
      addSkippedDuplicatePairAtRoot(libA.path, sides.cardIdA, sides.cardIdB);
      return;
    }
    const container = resolveContainerPathForDuplicates();
    if (!container) {
      throw new Error('Не удалось сохранить пару: контейнер библиотек недоступен');
    }
    addCrossSkippedPair(container, libA.id, sides.cardIdA, libB.id, sides.cardIdB);
  });

  ipcMain.handle('arc:duplicate-scan-run', async (event, payload: unknown) => {
    if (duplicateScanRunInFlight) {
      return duplicateScanEmptyResult({ busy: true });
    }
    duplicateScanRunInFlight = true;
    try {
    const root = await readLibraryRoot();
    if (!root) {
      return duplicateScanEmptyResult();
    }
    await ensureLibraryReady(root);

    let thresholdPct = await getDuplicateThresholdFromSystem(root);
    let resetSession = false;
    if (payload && typeof payload === 'object') {
      const p = payload as { thresholdPct?: unknown; resetSession?: unknown };
      if (typeof p.thresholdPct === 'number') {
        thresholdPct = Math.min(100, Math.max(50, Math.round(p.thresholdPct)));
      }
      if (p.resetSession === true) resetSession = true;
    }
    if (resetSession) resetDuplicateScanSession();

    const scope = parseScanScope(payload);
    const libraries = resolveScanLibraries(root, scope);
    const intraSkippedByLibrary = new Map<string, Set<string>>();
    for (const lib of libraries) {
      intraSkippedByLibrary.set(
        lib.id,
        new Set(listSkippedDuplicatePairsReadonly(lib.path).map(([a, b]) => pairKey(a, b)))
      );
    }
    const container = resolveContainerPathForDuplicates();
    const crossSkipped = container ? loadCrossSkippedPairKeys(container) : new Set<string>();

    const startedAt = Date.now();
    const sender = event.sender;
    const result = await runDuplicateScan(libraries, thresholdPct, {
      yieldToNavigation: true,
      intraSkippedByLibrary,
      crossSkipped,
      onProgress: ({ scannedCards, totalCards, duplicatesFound }) => {
        if (sender.isDestroyed()) return;
        const elapsedMs = Date.now() - startedAt;
        const fraction = totalCards > 0 ? scannedCards / totalCards : 0;
        const etaMs = fraction > 0 ? Math.round((elapsedMs / fraction) * (1 - fraction)) : null;
        sender.send('arc:duplicate-scan-progress', {
          scannedCards,
          totalCards,
          duplicatesFound,
          etaMs
        });
      }
    });

    return {
      pairs: enrichPairsWithCards(result.pairs.slice(0, MAX_DUPLICATE_PAIRS_IPC)),
      thresholdPct,
      scannedCards: result.scannedCards,
      totalCards: result.totalCards,
      duplicatesFound: result.pairs.length,
      spaceSavedBytes: result.spaceSavedBytes,
      cancelled: result.cancelled,
      busy: false
    };
    } finally {
      duplicateScanRunInFlight = false;
    }
  });

  ipcMain.handle('arc:duplicate-scan-cancel', async () => {
    requestScanCancel();
    return { ok: true as const };
  });

  ipcMain.handle('arc:duplicate-scan-start', async () => {
    void triggerDuplicateScanAfterImport();
    return { ok: true as const };
  });
}

export { addSkippedDuplicatePair };
