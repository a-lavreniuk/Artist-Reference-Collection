import type { CollectionRecord } from '../arcSchema';
import * as storage from '../storageClient';
import {
  persistCollections,
  readCollectionsUnified,
  resolveBackend,
  STORAGE_KEYS,
  tryAppendLibraryHistory
} from './backend';
import { historyQuotedEntity } from '../historySegments';
import { newId, normalizeCardRecord, safeReadArray, safeWriteArray, sortCollections } from './internal';
import { notifyCardsChanged, notifyCollectionsChanged } from './events';
import type { CollectionStats } from './types';
import type { CardRecord } from '../arcSchema';

export async function getAllCollections(): Promise<CollectionRecord[]> {
  return sortCollections(await readCollectionsUnified());
}

export type CollectionsSidebarMeta = {
  collections: CollectionRecord[];
  counts: Record<string, number>;
  previews: Record<string, CardRecord[]>;
};

/** Один IPC: коллекции + счётчики + опционально превью для strip. */
export async function getCollectionsSidebarMeta(previewLimit = 0): Promise<CollectionsSidebarMeta> {
  const b = await resolveBackend();
  if (b !== 'file') {
    const collections = await getAllCollections();
    const { getCollectionCardCounts, getCollectionPreviewSlices } = await import('./cards');
    const counts = await getCollectionCardCounts();
    const previews = previewLimit > 0 ? await getCollectionPreviewSlices(previewLimit) : {};
    return { collections, counts, previews };
  }
  const raw = await storage.storageCollectionsSidebar({ previewLimit });
  return {
    collections: sortCollections(raw.collections ?? []),
    counts: raw.counts ?? {},
    previews: raw.previews ?? {}
  };
}

export async function getCollectionById(id: string): Promise<CollectionRecord | null> {
  const all = await getAllCollections();
  return all.find((c) => c.id === id) ?? null;
}

export async function addCollection(
  name: string,
  extras?: { description?: string }
): Promise<CollectionRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название коллекции не может быть пустым');
  }
  const existing = await getAllCollections();
  if (existing.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Коллекция с таким названием уже есть');
  }
  const maxSort = existing.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const desc = extras?.description?.trim();
  const created: CollectionRecord = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    sortIndex: maxSort + 1,
    ...(desc ? { description: desc } : {})
  };

  await persistCollections([...existing, created]);
  return created;
}

export async function updateCollection(
  collectionId: string,
  patch: { name?: string; description?: string }
): Promise<void> {
  const list = await readCollectionsUnified();
  const current = list.find((c) => c.id === collectionId);
  if (!current) return;

  let name = current.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Название не может быть пустым');
    if (list.some((c) => c.id !== collectionId && c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('Коллекция с таким названием уже есть');
    }
    name = trimmed;
  }

  const next = list.map((c) => {
    if (c.id !== collectionId) return c;
    const updated: CollectionRecord = { ...c, name };
    if (patch.description !== undefined) {
      const desc = patch.description.trim();
      if (desc) updated.description = desc;
      else delete updated.description;
    }
    return updated;
  });
  await persistCollections(next);
}

export async function renameCollection(collectionId: string, name: string): Promise<void> {
  await updateCollection(collectionId, { name });
}

export async function reorderCollectionToIndex(id: string, insertIndex: number): Promise<void> {
  const sorted = await getAllCollections();
  const fromIndex = sorted.findIndex((c) => c.id === id);
  if (fromIndex < 0) return;

  const clamped = Math.max(0, Math.min(insertIndex, sorted.length));
  if (clamped === fromIndex || clamped === fromIndex + 1) return;

  const next = [...sorted];
  const [item] = next.splice(fromIndex, 1);
  const targetIndex = clamped > fromIndex ? clamped - 1 : clamped;
  next.splice(targetIndex, 0, item);

  const idToSort = new Map(next.map((c, i) => [c.id, i]));
  const list = (await readCollectionsUnified()).map((c) => ({
    ...c,
    sortIndex: idToSort.get(c.id) ?? c.sortIndex
  }));
  await persistCollections(list);
}

export async function getCollectionStats(collectionId: string): Promise<CollectionStats> {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return { cardCount: 0, totalSizeMb: 0, createdAt: new Date().toISOString() };
  }

  const b = await resolveBackend();
  if (b === 'file') {
    const stats = await storage.storageCollectionStats(collectionId);
    if (stats) return stats;
    return { cardCount: 0, totalSizeMb: 0, createdAt: collection.createdAt };
  }

  const { getCollectionCardCounts, listCardsInCollection } = await import('./cards');
  const counts = await getCollectionCardCounts();
  const cards = await listCardsInCollection(collectionId, { offset: 0, limit: 100000 });
  const totalBytes = cards.reduce((sum, c) => sum + (c.fileSize ?? 0), 0);
  return {
    cardCount: counts[collectionId] ?? cards.length,
    totalSizeMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    createdAt: collection.createdAt
  };
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const existingCols = await getAllCollections();
  const removed = existingCols.find((c) => c.id === collectionId);
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageDeleteCollection(collectionId);
  } else {
    await persistCollections(existingCols.filter((c) => c.id !== collectionId));
    const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
      .map(normalizeCardRecord)
      .filter((c): c is CardRecord => c !== null);
    if (localCards.length > 0) {
      const next = localCards.map((c) =>
        c.collectionIds.some((id) => id === collectionId)
          ? { ...c, collectionIds: c.collectionIds.filter((id) => id !== collectionId) }
          : c
      );
      safeWriteArray(STORAGE_KEYS.cards, next);
    }
  }
  notifyCollectionsChanged();
  notifyCardsChanged();
  if (removed?.name) {
    const entry = historyQuotedEntity('Удалена коллекция «', {
      entityType: 'collection',
      id: collectionId,
      label: removed.name
    });
    void tryAppendLibraryHistory(entry.message, entry.segments);
  }
}
