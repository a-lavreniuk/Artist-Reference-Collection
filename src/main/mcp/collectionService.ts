import { randomUUID } from 'crypto';

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

function assertUniqueName(collections: CollectionRow[], name: string, exceptId?: string): void {
  const lower = name.toLowerCase();
  if (collections.some((c) => c.id !== exceptId && c.name.toLowerCase() === lower)) {
    throw new Error('Коллекция с таким названием уже существует');
  }
}

export function createCollectionRecord(
  libraryRoot: string,
  input: { name: string; description?: string }
): CollectionRow {
  const name = normalizeName(input.name);
  const collections = listCollections(libraryRoot);
  assertUniqueName(collections, name);
  const maxSort = collections.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const col: CollectionRow = {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    sortIndex: maxSort + 1,
    ...(input.description?.trim() ? { description: input.description.trim() } : {})
  };
  upsertCollection(libraryRoot, col);
  return col;
}

export function ensureCollectionRecord(
  libraryRoot: string,
  input: { name: string; description?: string }
): { collection: CollectionRow; created: boolean } {
  const name = normalizeName(input.name);
  const collections = listCollections(libraryRoot);
  const existing = collections.find((c) => c.name.toLowerCase() === name.toLowerCase());
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
  assertUniqueName(collections, name, existing.id);
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
    if (row.collectionIds.includes(collectionId)) continue;
    await updateCardInStorage(libraryRoot, cardId, {
      collectionIds: [...row.collectionIds, collectionId]
    });
    updated.push(cardId);
  }
  return { updated };
}

export async function removeCardsFromCollection(
  libraryRoot: string,
  collectionId: string,
  cardIds: string[]
): Promise<{ updated: string[] }> {
  const updated: string[] = [];
  for (const cardId of cardIds) {
    const row = getCardByIdFromDb(libraryRoot, cardId);
    if (!row) continue;
    if (!row.collectionIds.includes(collectionId)) continue;
    await updateCardInStorage(libraryRoot, cardId, {
      collectionIds: row.collectionIds.filter((id) => id !== collectionId)
    });
    updated.push(cardId);
  }
  return { updated };
}
