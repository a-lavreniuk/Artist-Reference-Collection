import type { CardRecord } from '../../services/db';
import {
  addCardToMoodboard,
  getCardById,
  permanentDeleteCard,
  removeCardFromMoodboard,
  restoreCard,
  softDeleteCard,
  updateCardPayload
} from '../../services/db';
import { showAppNotification } from '../../services/notificationService';

export function libraryMapsFromCards(
  cardsById: ReadonlyMap<string, CardRecord>,
  ids: readonly string[]
): {
  libraryIdByCard: Map<string, string | undefined>;
  sourceRootByCard: Map<string, string | undefined>;
} {
  const libraryIdByCard = new Map<string, string | undefined>();
  const sourceRootByCard = new Map<string, string | undefined>();
  for (const id of ids) {
    const card = cardsById.get(id);
    libraryIdByCard.set(id, card?.libraryId);
    sourceRootByCard.set(id, card?.libraryRoot);
  }
  return { libraryIdByCard, sourceRootByCard };
}

export async function bulkSendToTrash(
  cardIds: readonly string[],
  libraryIdByCard?: ReadonlyMap<string, string | undefined>
): Promise<string[]> {
  const affected: string[] = [];
  for (const cardId of cardIds) {
    await softDeleteCard(cardId, libraryIdByCard?.get(cardId));
    affected.push(cardId);
  }
  return affected;
}

export async function bulkPermanentDelete(
  cardIds: readonly string[],
  libraryIdByCard?: ReadonlyMap<string, string | undefined>
): Promise<string[]> {
  if (cardIds.length === 0) return [];
  const { requestDestructiveConfirm } = await import('../../services/destructiveConfirm');
  const token = await requestDestructiveConfirm({
    kind: 'permanent-delete-card',
    uses: cardIds.length
  });
  const affected: string[] = [];
  for (const cardId of cardIds) {
    await permanentDeleteCard(cardId, token, libraryIdByCard?.get(cardId));
    affected.push(cardId);
  }
  return affected;
}

export async function bulkRestore(
  cardIds: readonly string[],
  options?: {
    libraryIdByCard?: ReadonlyMap<string, string | undefined>;
    sourceRootByCard?: ReadonlyMap<string, string | undefined>;
  }
): Promise<string[]> {
  const affected: string[] = [];
  let originMissing = 0;
  let filesUnavailable = 0;
  let otherFail = 0;
  for (const cardId of cardIds) {
    const result = await restoreCard(cardId, {
      libraryId: options?.libraryIdByCard?.get(cardId),
      sourceLibraryRoot: options?.sourceRootByCard?.get(cardId)
    });
    if (result.ok) {
      affected.push(cardId);
      continue;
    }
    if (result.error === 'origin-missing') originMissing += 1;
    else if (result.error === 'files-unavailable') filesUnavailable += 1;
    else otherFail += 1;
  }
  if (originMissing + filesUnavailable + otherFail > 0) {
    showAppNotification({
      message:
        originMissing > 0
          ? 'Часть карточек не восстановлена: библиотека недоступна. Откройте карточку, чтобы выбрать, куда восстановить.'
          : filesUnavailable > 0
            ? 'Часть карточек не восстановлена: файлы недоступны.'
            : 'Не удалось восстановить часть карточек.',
      variant: 'danger'
    });
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
