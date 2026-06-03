import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { readdir, stat, unlink } from 'fs/promises';
import {
  CARDS_DIR,
  LIBRARY_META_DIR
} from './libraryFilenames';
import {
  addSkippedDuplicatePair,
  countCards,
  deleteCardFromStorage,
  deleteCategoryFromDb,
  deleteCollectionFromDb,
  deleteTagFromDb,
  ensureLibraryReady,
  getCardByIdFromDb,
  getCardsWithPhash,
  getCollectionCardCounts,
  getMoodboardData,
  getSystemData,
  importMediaFile,
  insertCardMetadata,
  listAllTags,
  listCardsFromDb,
  listCategories,
  listCollections,
  listSkippedDuplicatePairs,
  listTagsByCategory,
  rebuildIndexFromCardJson,
  rowToCardRecord,
  saveMoodboardData,
  saveSystemData,
  setMigrationProgressCallback,
  updateCardInStorage,
  upsertCategory,
  upsertCollection,
  upsertTag
} from './storage/libraryStorage';
import type { ArcMoodboardV1, ArcSystemV1, CategoryRow, CollectionRow, ListCardsParams, TagRow } from './storage/types';

let storageIpcRegistered = false;

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
    description: row.description
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
    return { ok: true as const };
  });

  ipcMain.handle('arc:import-files', async (_e, absolutePaths: unknown) => {
    assertNotMaintenance();
    if (!Array.isArray(absolutePaths) || !absolutePaths.every((x) => typeof x === 'string')) {
      throw new Error('Неверный список файлов');
    }
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    await ensureLibraryReady(root);
    const results = [];
    for (const abs of absolutePaths as string[]) {
      results.push(await importMediaFile(root, abs));
    }
    return results;
  });

  ipcMain.handle('arc:storage-list-cards', async (_e, params: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    const p = params as ListCardsParams;
    return listCardsFromDb(root, p).map((r) => cardIndexToRenderer(rowToCardRecord(r)));
  });

  ipcMain.handle('arc:storage-get-card', async (_e, cardId: unknown) => {
    const root = await readLibraryRoot();
    if (!root || typeof cardId !== 'string') return null;
    await ensureLibraryReady(root);
    const row = getCardByIdFromDb(root, cardId);
    return row ? cardIndexToRenderer(rowToCardRecord(row)) : null;
  });

  ipcMain.handle('arc:storage-update-card', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    const p = payload as { cardId: string; patch: { tagIds?: string[]; collectionIds?: string[]; description?: string } };
    await updateCardInStorage(root, p.cardId, p.patch);
  });

  ipcMain.handle('arc:storage-insert-cards-metadata', async (_e, cards: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    if (!Array.isArray(cards)) throw new Error('Неверные данные');
    await insertCardMetadata(root, cards as Parameters<typeof insertCardMetadata>[1]);
  });

  ipcMain.handle('arc:storage-delete-card', async (_e, cardId: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root || typeof cardId !== 'string') return;
    await deleteCardFromStorage(root, cardId);
  });

  ipcMain.handle('arc:storage-count-cards', async (_e, filter: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return 0;
    await ensureLibraryReady(root);
    const f = filter === 'images' || filter === 'videos' ? filter : 'all';
    return countCards(root, f);
  });

  ipcMain.handle('arc:storage-list-categories', async () => {
    const root = await readLibraryRoot();
    if (!root) return [];
    await ensureLibraryReady(root);
    return listCategories(root);
  });

  ipcMain.handle('arc:storage-upsert-category', async (_e, cat: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRoot();
    if (!root) throw new Error('Библиотека не выбрана');
    upsertCategory(root, cat as CategoryRow);
  });

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

  ipcMain.handle('arc:storage-list-collections', async () => {
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
    const root = await readLibraryRoot();
    if (!root) return {};
    await ensureLibraryReady(root);
    return getCollectionCardCounts(root);
  });

  ipcMain.handle('arc:storage-get-moodboard', async () => {
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

  ipcMain.handle('arc:scan-library-orphan-files', async (_e, referencedList: unknown) => {
    const root = await readLibraryRoot();
    if (!root) return { orphans: [] as string[] };
    if (!Array.isArray(referencedList)) return { orphans: [] as string[] };
    const referenced = new Set<string>();
    for (const r of referencedList) {
      if (typeof r !== 'string' || !r.trim()) continue;
      referenced.add(r.replace(/\\/g, '/'));
    }
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
      return !referenced.has(norm);
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
}

export { walkCardsRelativeFiles };
