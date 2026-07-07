import {
  addCardToMoodboard,
  getCardById,
  permanentDeleteCard,
  restoreCard,
  softDeleteCard,
  updateCardPayload
} from '../../services/db';

export async function bulkSendToTrash(cardIds: readonly string[]): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    await softDeleteCard(cardId);
    count += 1;
  }
  return count;
}

export async function bulkPermanentDelete(cardIds: readonly string[]): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    await permanentDeleteCard(cardId);
    count += 1;
  }
  return count;
}

export async function bulkRestore(cardIds: readonly string[]): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    await restoreCard(cardId);
    count += 1;
  }
  return count;
}

export async function bulkAddMissingToMoodboard(
  cardIds: readonly string[],
  moodboardCardIds: ReadonlySet<string>
): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    if (moodboardCardIds.has(cardId)) continue;
    await addCardToMoodboard(cardId);
    count += 1;
  }
  return count;
}

export async function bulkAddToCollection(
  cardIds: readonly string[],
  collectionId: string
): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || card.collectionIds.includes(collectionId)) continue;
    await updateCardPayload(cardId, {
      collectionIds: [...card.collectionIds, collectionId]
    });
    count += 1;
  }
  return count;
}

export async function bulkRemoveFromCollection(
  cardIds: readonly string[],
  collectionId: string
): Promise<number> {
  let count = 0;
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || !card.collectionIds.includes(collectionId)) continue;
    await updateCardPayload(cardId, {
      collectionIds: card.collectionIds.filter((id) => id !== collectionId)
    });
    count += 1;
  }
  return count;
}

export async function bulkToggleCollectionForCards(
  cardIds: readonly string[],
  collectionId: string,
  nextSelected: boolean
): Promise<number> {
  if (nextSelected) return bulkAddToCollection(cardIds, collectionId);
  return bulkRemoveFromCollection(cardIds, collectionId);
}

export type BulkCollectionState = 'none' | 'some' | 'all';

export function resolveBulkCollectionState(
  cardIds: readonly string[],
  cardsById: ReadonlyMap<string, { collectionIds: string[] }>,
  collectionId: string
): BulkCollectionState {
  if (cardIds.length === 0) return 'none';
  let withCollection = 0;
  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (card?.collectionIds.includes(collectionId)) withCollection += 1;
  }
  if (withCollection === 0) return 'none';
  if (withCollection === cardIds.length) return 'all';
  return 'some';
}

export function unionCollectionIdsForCards(
  cardIds: readonly string[],
  cardsById: ReadonlyMap<string, { collectionIds: string[] }>
): string[] {
  const union = new Set<string>();
  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (!card) continue;
    for (const id of card.collectionIds) union.add(id);
  }
  return [...union];
}
