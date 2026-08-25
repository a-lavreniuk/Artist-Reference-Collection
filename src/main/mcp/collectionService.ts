import { randomUUID } from 'crypto';

import {
  addCollectionToCardIds,
  assertCollectionParentIsRoot,
  collectionParentId,
  removeCollectionFromCardIds,
  siblingNameTaken
} from '../shared/collectionHierarchy';
import {
  deleteCollectionFromDb,
  getCardByIdFromDb,
  getCollectionPreviewSlicesFromDb,
  getCollectionStats,
  listCollections,
  updateCardInStorage,
  upsertCollection
} from '../storage/libraryStorage';
import type { CollectionRow } from '../storage/types';

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Название коллекции не может быть пустым');
  return trimmed;
}

function assertUniqueSiblingName(
  collections: CollectionRow[],
  name: string,
  parentId: string | null,
  exceptId?: string
): void {
  if (siblingNameTaken(collections, name, parentId, exceptId)) {
    throw new Error(
      parentId ? 'Раздел с таким названием уже есть' : 'Коллекция с таким названием уже есть'
    );
  }
}

export function createCollectionRecord(
  libraryRoot: string,
  input: { name: string; description?: string; parentId?: string }
): CollectionRow {
  const name = normalizeName(input.name);
  const collections = listCollections(libraryRoot);
  const parentId = input.parentId?.trim() || undefined;
  if (parentId) assertCollectionParentIsRoot(collections, parentId);
  assertUniqueSiblingName(collections, name, parentId ?? null);
  const siblings = collections.filter((item) => collectionParentId(item) === (parentId ?? null));
  const maxSort = siblings.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const col: CollectionRow = {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    sortIndex: maxSort + 1,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(parentId ? { parentId } : {})
  };
  upsertCollection(libraryRoot, col);
  return col;
}

export function ensureCollectionRecord(
  libraryRoot: string,
  input: { name: string; description?: string; parentId?: string }
): { collection: CollectionRow; created: boolean } {
  const name = normalizeName(input.name);
  const collections = listCollections(libraryRoot);
  const parentId = input.parentId?.trim() || undefined;
  const existing = collections.find(
    (c) =>
      collectionParentId(c) === (parentId ?? null) && c.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return { collection: existing, created: false };
  }
  return {
    collection: createCollectionRecord(libraryRoot, input),
    created: true
  };
}

export function updateCollectionRecord(
  libraryRoot: string,
  input: { collectionId: string; name?: string; description?: string }
): CollectionRow {
  const collections = listCollections(libraryRoot);
  const existing = collections.find((c) => c.id === input.collectionId);
  if (!existing) throw new Error('Коллекция не найдена');
  const name = input.name !== undefined ? normalizeName(input.name) : existing.name;
  assertUniqueSiblingName(collections, name, collectionParentId(existing), existing.id);
  const col: CollectionRow = {
    ...existing,
    name,
    description:
      input.description !== undefined
        ? input.description.trim() || undefined
        : existing.description
  };
  upsertCollection(libraryRoot, col);
  return col;
}

export async function deleteCollectionRecord(libraryRoot: string, collectionId: string): Promise<void> {
  const collections = listCollections(libraryRoot);
  if (!collections.some((c) => c.id === collectionId)) {
    throw new Error('Коллекция не найдена');
  }
  await deleteCollectionFromDb(libraryRoot, collectionId);
}

export function getCollectionDetails(
  libraryRoot: string,
  collectionId: string,
  previewLimit = 8
): {
  collection: CollectionRow;
  stats: ReturnType<typeof getCollectionStats>;
  previewCardIds: string[];
} {
  const collections = listCollections(libraryRoot);
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error('Коллекция не найдена');
  const stats = getCollectionStats(libraryRoot, collectionId);
  const previews = getCollectionPreviewSlicesFromDb(libraryRoot, previewLimit);
  return {
    collection,
    stats,
    previewCardIds: (previews[collectionId] ?? []).map((r) => r.id)
  };
}

export async function addCardsToCollection(
  libraryRoot: string,
  collectionId: string,
  cardIds: string[]
): Promise<{ updated: string[] }> {
  const collections = listCollections(libraryRoot);
  if (!collections.some((c) => c.id === collectionId)) {
    throw new Error('Коллекция не найдена');
  }
  const updated: string[] = [];
  for (const cardId of cardIds) {
    const row = getCardByIdFromDb(libraryRoot, cardId);
    if (!row) continue;
    const nextIds = addCollectionToCardIds(row.collectionIds, collectionId, collections);
    if (nextIds.length === row.collectionIds.length && nextIds.every((id) => row.collectionIds.includes(id))) {
      continue;
    }
    await updateCardInStorage(libraryRoot, cardId, { collectionIds: nextIds });
    updated.push(cardId);
  }
  return { updated };
}

export async function removeCardsFromCollection(
  libraryRoot: string,
  collectionId: string,
  cardIds: string[]
): Promise<{ updated: string[] }> {
  const collections = listCollections(libraryRoot);
  const updated: string[] = [];
  for (const cardId of cardIds) {
    const row = getCardByIdFromDb(libraryRoot, cardId);
    if (!row) continue;
    if (!row.collectionIds.includes(collectionId)) continue;
    await updateCardInStorage(libraryRoot, cardId, {
      collectionIds: removeCollectionFromCardIds(row.collectionIds, collectionId, collections)
    });
    updated.push(cardId);
  }
  return { updated };
}
