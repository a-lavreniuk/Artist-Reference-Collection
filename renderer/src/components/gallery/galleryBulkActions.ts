import {
  addCardToMoodboard,
  getCardById,
  permanentDeleteCard,
  removeCardFromMoodboard,
  restoreCard,
  softDeleteCard,
  updateCardPayload
} from '../../services/db';

export async function bulkSendToTrash(cardIds: readonly string[]): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    await softDeleteCard(cardId);
    affected.push(cardId);
  }
  return affected;
}

export async function bulkPermanentDelete(cardIds: readonly string[]): Promise<string[]> {
  if (cardIds.length === 0) return [];
  const { requestDestructiveConfirm } = await import('../../services/destructiveConfirm');
  const token = await requestDestructiveConfirm({
    kind: 'permanent-delete-card',
    uses: cardIds.length
  });
  const affected: string[] = [];
  for (const cardId of cardIds) {
    await permanentDeleteCard(cardId, token);
    affected.push(cardId);
  }
  return affected;
}

export async function bulkRestore(cardIds: readonly string[]): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    await restoreCard(cardId);
    affected.push(cardId);
  }
  return affected;
}

export async function bulkAddMissingToMoodboard(
  cardIds: readonly string[],
  moodboardCardIds: ReadonlySet<string>
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    if (moodboardCardIds.has(cardId)) continue;
    await addCardToMoodboard(cardId);
    affected.push(cardId);
  }
  return affected;
}

export async function bulkRemoveFromMoodboard(
  cardIds: readonly string[],
  moodboardCardIds: ReadonlySet<string>
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    if (!moodboardCardIds.has(cardId)) continue;
    await removeCardFromMoodboard(cardId);
    affected.push(cardId);
  }
  return affected;
}

export async function bulkAddToCollection(
  cardIds: readonly string[],
  collectionId: string
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || card.collectionIds.includes(collectionId)) continue;
    await updateCardPayload(cardId, {
      collectionIds: [...card.collectionIds, collectionId]
    });
    affected.push(cardId);
  }
  return affected;
}

export async function bulkRemoveFromCollection(
  cardIds: readonly string[],
  collectionId: string
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || !card.collectionIds.includes(collectionId)) continue;
    await updateCardPayload(cardId, {
      collectionIds: card.collectionIds.filter((id) => id !== collectionId)
    });
    affected.push(cardId);
  }
  return affected;
}

export async function bulkToggleCollectionForCards(
  cardIds: readonly string[],
  collectionId: string,
  nextSelected: boolean
): Promise<string[]> {
  if (nextSelected) return bulkAddToCollection(cardIds, collectionId);
  return bulkRemoveFromCollection(cardIds, collectionId);
}

export async function bulkAddTagToCards(
  cardIds: readonly string[],
  tagId: string
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || card.tagIds.includes(tagId)) continue;
    await updateCardPayload(cardId, { tagIds: [...card.tagIds, tagId] });
    affected.push(cardId);
  }
  return affected;
}

export async function bulkRemoveTagFromCards(
  cardIds: readonly string[],
  tagId: string
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    const card = await getCardById(cardId);
    if (!card || !card.tagIds.includes(tagId)) continue;
    await updateCardPayload(cardId, {
      tagIds: card.tagIds.filter((id) => id !== tagId)
    });
    affected.push(cardId);
  }
  return affected;
}

export async function bulkToggleTagForCards(
  cardIds: readonly string[],
  tagId: string,
  nextSelected: boolean
): Promise<string[]> {
  if (nextSelected) return bulkAddTagToCards(cardIds, tagId);
  return bulkRemoveTagFromCards(cardIds, tagId);
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

export type BulkTagState = 'none' | 'some' | 'all';

export function resolveBulkTagState(
  cardIds: readonly string[],
  cardsById: ReadonlyMap<string, { tagIds: string[] }>,
  tagId: string
): BulkTagState {
  if (cardIds.length === 0) return 'none';
  let withTag = 0;
  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (card?.tagIds.includes(tagId)) withTag += 1;
  }
  if (withTag === 0) return 'none';
  if (withTag === cardIds.length) return 'all';
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
