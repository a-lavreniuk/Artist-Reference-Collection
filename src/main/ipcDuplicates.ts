import { BrowserWindow, ipcMain } from 'electron';

import {
  addSessionSkippedPair,
  checkImportDuplicates,
  getCachedDuplicatePairs,
  getDuplicateThresholdFromSystem,
  isExactDuplicateIncomingFile,
  probeIncomingFileMetadata,
  requestScanCancel,
  resetDuplicateScanSession,
  runDuplicateScan,
  scanDuplicatePairs,
  scanForDuplicateFilesAfterImport,
  type DuplicatePairDto
} from './duplicateScanService';
import {
  addSkippedDuplicatePair,
  ensureLibraryReady,
  getCardByIdFromDb,
  mergeDuplicateCards,
  replaceCardOriginalFromFile,
  rowToCardRecord
} from './storage/libraryStorage';

let ipcRegistered = false;

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
    durationMs: row.durationMs
  };
}

function enrichPairsWithCards(root: string, pairs: DuplicatePairDto[]) {
  return pairs.map((pair) => {
    const rowA = getCardByIdFromDb(root, pair.cardIdA);
    const rowB = getCardByIdFromDb(root, pair.cardIdB);
    return {
      ...pair,
      cardA: rowA ? cardIndexToRenderer(rowToCardRecord(rowA)) : null,
      cardB: rowB ? cardIndexToRenderer(rowToCardRecord(rowB)) : null
    };
  });
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
    const matches = await checkImportDuplicates(root, absolutePaths as string[]);
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
    return isExactDuplicateIncomingFile(root, absolutePath);
  });

  ipcMain.handle('arc:probe-incoming-file', async (_e, absolutePath: unknown) => {
    if (typeof absolutePath !== 'string') return null;
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
    return { pairs, thresholdPct };
  });

  ipcMain.handle('arc:duplicate-session-skip-pair', async (_e, idA: unknown, idB: unknown) => {
    if (typeof idA !== 'string' || typeof idB !== 'string') return;
    addSessionSkippedPair(idA, idB);
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
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    if (!payload || typeof payload !== 'object') throw new Error('Неверные параметры');
    const p = payload as { primaryId?: unknown; secondaryId?: unknown };
    if (typeof p.primaryId !== 'string' || typeof p.secondaryId !== 'string') {
      throw new Error('Неверные параметры');
    }
    await ensureLibraryReady(root);
    await mergeDuplicateCards(root, p.primaryId, p.secondaryId);
    const { refreshLibrarySessionSnapshotFromDisk } = await import('./librarySessionSnapshot');
    void refreshLibrarySessionSnapshotFromDisk();
  });

  ipcMain.handle('arc:duplicate-scan-run', async (event, payload: unknown) => {
    // Скан — это и есть операция обслуживания; блокировку держит рендерер (maintenanceBegin/End),
    // поэтому здесь assertNotMaintenance не вызываем, иначе собственный лок отклонит запрос.
    const root = await readLibraryRoot();
    if (!root) {
      return {
        pairs: [],
        thresholdPct: 85,
        scannedCards: 0,
        totalCards: 0,
        duplicatesFound: 0,
        spaceSavedBytes: 0,
        cancelled: false
      };
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

    const startedAt = Date.now();
    const sender = event.sender;
    const result = await runDuplicateScan(root, thresholdPct, {
      yieldToNavigation: false,
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
      pairs: enrichPairsWithCards(root, result.pairs),
      thresholdPct,
      scannedCards: result.scannedCards,
      totalCards: result.totalCards,
      duplicatesFound: result.pairs.length,
      spaceSavedBytes: result.spaceSavedBytes,
      cancelled: result.cancelled
    };
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
