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
import {
  addCollectionToCardIds,
  assertCollectionParentIsRoot,
  collectionParentId,
  descendantOrSelfIds,
  isCollectionSection,
  normalizeCardCollectionIds,
  removeCollectionFromCardIds,
  siblingNameTaken,
  uniqueCopyName,
  uniqueSiblingName
} from '@arc-main-shared/collectionHierarchy';

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
  extras?: { description?: string; parentId?: string }
): Promise<CollectionRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название коллекции не может быть пустым');
  }
  const existing = await readCollectionsUnified();
  const parentId = extras?.parentId?.trim() || undefined;
  if (parentId) assertCollectionParentIsRoot(existing, parentId);
  if (siblingNameTaken(existing, trimmed, parentId ?? null)) {
    throw new Error(parentId ? 'Раздел с таким названием уже есть' : 'Коллекция с таким названием уже есть');
  }
  const siblings = existing.filter((item) => collectionParentId(item) === (parentId ?? null));
  const maxSort = siblings.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const desc = extras?.description?.trim();
  const created: CollectionRecord = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    sortIndex: maxSort + 1,
    ...(desc ? { description: desc } : {}),
    ...(parentId ? { parentId } : {})
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
    if (siblingNameTaken(list, trimmed, collectionParentId(current), collectionId)) {
      throw new Error(
        isCollectionSection(current) ? 'Раздел с таким названием уже есть' : 'Коллекция с таким названием уже есть'
      );
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
  const list = await readCollectionsUnified();
  const item = list.find((c) => c.id === id);
  if (!item) return;
  const parentId = collectionParentId(item);
  const siblings = list
    .filter((c) => collectionParentId(c) === parentId)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru'));
  const fromIndex = siblings.findIndex((c) => c.id === id);
  if (fromIndex < 0) return;

  const clamped = Math.max(0, Math.min(insertIndex, siblings.length));
  if (clamped === fromIndex || clamped === fromIndex + 1) return;

  const nextSiblings = [...siblings];
  const [moved] = nextSiblings.splice(fromIndex, 1);
  const targetIndex = clamped > fromIndex ? clamped - 1 : clamped;
  nextSiblings.splice(targetIndex, 0, moved);

  const idToSort = new Map(nextSiblings.map((c, i) => [c.id, i]));
  const next = list.map((c) => ({
    ...c,
    sortIndex: idToSort.get(c.id) ?? c.sortIndex
  }));
  await persistCollections(next);
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

function rewriteLocalCardMemberships(removeIds: string[], collections: CollectionRecord[]): void {
  const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  if (localCards.length === 0) return;
  const next = localCards.map((c) => {
    const nextIds = removeIds.reduce(
      (ids, collectionId) => removeCollectionFromCardIds(ids, collectionId, collections),
      c.collectionIds
    );
    return nextIds === c.collectionIds ? c : { ...c, collectionIds: nextIds };
  });
  safeWriteArray(STORAGE_KEYS.cards, next);
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const existingCols = await readCollectionsUnified();
  const removed = existingCols.find((c) => c.id === collectionId);
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageDeleteCollection(collectionId);
  } else {
    const removeIds = new Set(descendantOrSelfIds(existingCols, collectionId));
    await persistCollections(existingCols.filter((c) => !removeIds.has(c.id)));
    rewriteLocalCardMemberships([...removeIds], existingCols);
  }
  notifyCollectionsChanged();
  notifyCardsChanged();
  if (removed?.name) {
    const label = isCollectionSection(removed) ? 'Удалён раздел «' : 'Удалена коллекция «';
    const entry = historyQuotedEntity(label, {
      entityType: 'collection',
      id: collectionId,
      label: removed.name
    });
    void tryAppendLibraryHistory(entry.message, entry.segments);
  }
}

export async function mergeCollectionInto(sourceId: string, targetId: string): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageMergeCollection({ sourceId, targetId });
    notifyCollectionsChanged();
    notifyCardsChanged();
    return;
  }
  const list = await readCollectionsUnified();
  const source = list.find((c) => c.id === sourceId);
  const target = list.find((c) => c.id === targetId);
  if (!source || !target) throw new Error('Коллекция не найдена');
  if (!isCollectionSection(source) || !isCollectionSection(target)) {
    throw new Error('Сливать можно только разделы');
  }
  const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  if (localCards.length > 0) {
    const next = localCards.map((c) => {
      if (!c.collectionIds.includes(sourceId)) return c;
      let ids = addCollectionToCardIds(c.collectionIds, targetId, list);
      ids = removeCollectionFromCardIds(ids, sourceId, list);
      return { ...c, collectionIds: ids };
    });
    safeWriteArray(STORAGE_KEYS.cards, next);
  }
  await persistCollections(list.filter((c) => c.id !== sourceId));
  notifyCardsChanged();
}

export async function duplicateCollection(sourceId: string): Promise<CollectionRecord> {
  const b = await resolveBackend();
  if (b === 'file') {
    const copy = await storage.storageDuplicateCollection(sourceId);
    notifyCollectionsChanged();
    notifyCardsChanged();
    return copy;
  }
  const list = await readCollectionsUnified();
  const source = list.find((c) => c.id === sourceId);
  if (!source) throw new Error('Коллекция не найдена');
  const parentId = collectionParentId(source);
  const copy: CollectionRecord = {
    id: newId(),
    name: uniqueCopyName(list, source.name, parentId),
    createdAt: new Date().toISOString(),
    sortIndex: source.sortIndex + 1,
    ...(source.description ? { description: source.description } : {}),
    ...(parentId ? { parentId } : {})
  };
  const bumped = list.map((item) =>
    collectionParentId(item) === parentId && item.sortIndex > source.sortIndex
      ? { ...item, sortIndex: item.sortIndex + 1 }
      : item
  );
  const nextList = [...bumped, copy];
  await persistCollections(nextList);
  const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  if (localCards.length > 0) {
    const next = localCards.map((c) =>
      c.collectionIds.includes(sourceId)
        ? { ...c, collectionIds: addCollectionToCardIds(c.collectionIds, copy.id, nextList) }
        : c
    );
    safeWriteArray(STORAGE_KEYS.cards, next);
  }
  notifyCardsChanged();
  return copy;
}

export async function moveCollectionToParent(sectionId: string, newParentId: string): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageMoveCollection({ sectionId, newParentId });
    notifyCollectionsChanged();
    notifyCardsChanged();
    return;
  }
  const list = await readCollectionsUnified();
  const section = list.find((c) => c.id === sectionId);
  if (!section) throw new Error('Раздел не найден');
  if (!isCollectionSection(section)) throw new Error('Переносить можно только раздел');
  const oldParentId = collectionParentId(section);
  if (!oldParentId) throw new Error('Раздел не найден');
  if (oldParentId === newParentId) return;
  assertCollectionParentIsRoot(list, newParentId);
  const moved: CollectionRecord = {
    ...section,
    parentId: newParentId,
    name: uniqueSiblingName(list, section.name, newParentId, sectionId)
  };
  const nextList = list.map((item) => (item.id === sectionId ? moved : item));
  await persistCollections(nextList);
  const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  if (localCards.length > 0) {
    const next = localCards.map((c) => {
      if (!c.collectionIds.includes(sectionId)) return c;
      const stripped = c.collectionIds.filter((id) => id !== oldParentId);
      return { ...c, collectionIds: normalizeCardCollectionIds(stripped, nextList) };
    });
    safeWriteArray(STORAGE_KEYS.cards, next);
  }
  notifyCardsChanged();
}
