import type { CardRecord } from '../arcSchema';
import { createEmptyMoodboardBoard } from '../arcSchema';
import { getDeleteCardsUseTrash } from '../../import/importDefaults';
import * as storage from '../storageClient';
import { resolveBackend, STORAGE_KEYS, tryAppendLibraryHistory } from './backend';
import { historyCardAction, historyQuotedEntity } from '../historySegments';
import {
  cardHasAllTagIds,
  normalizeCardRecord,
  safeReadArray,
  safeWriteArray
} from './internal';
import {
  notifyCardsChanged,
  notifyMoodboardBoardChanged,
  notifyTagsChanged
} from './events';
import {
  pruneMoodboardBoardForCard,
  readMoodboardBoardFromLocalStorage,
  writeMoodboardBoardToLocalStorage
} from './moodboard';
import type { CategoryWeight } from './types';
import { CATEGORY_WEIGHT_SCORE } from './types';

async function persistCards(list: CardRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    notifyCardsChanged();
    return;
  }
  safeWriteArray(
    STORAGE_KEYS.cards,
    list.map((c) => ({ id: c.id, type: c.type }))
  );
  notifyCardsChanged();
}

export async function listCardsSorted(filter: 'all' | 'images' | 'videos'): Promise<CardRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    const all = await storage.storageListCards({
      offset: 0,
      limit: 1_000_000
    });
    return all.filter((c) => {
      if (filter === 'images') return c.type === 'image';
      if (filter === 'videos') return c.type === 'video';
      return true;
    });
  }
  const cards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  const filtered = cards.filter((c) => {
    if (filter === 'images') return c.type === 'image';
    if (filter === 'videos') return c.type === 'video';
    return true;
  });
  return filtered.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function listCardsPage(params: {
  offset: number;
  limit: number;
  libraryScope?: import('../../search/libraryScopeUrl').LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters?: import('../../components/gallery/galleryFilterTypes').GalleryAdvancedFilters;
  sort?: import('../../components/gallery/galleryFilterTypes').GallerySortState;
}): Promise<CardRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageListCards({
      offset: params.offset,
      limit: params.limit,
      libraryScope: params.libraryScope,
      selectedTagIds: params.selectedTagIds,
      cardIdExact: params.cardIdExact,
      collectionId: params.collectionId,
      moodboardCardIds: params.moodboardCardIds,
      advancedFilters: params.advancedFilters,
      sort: params.sort
    });
  }
  const sorted = await listCardsSorted('all');
  const tagIds = (params.selectedTagIds ?? []).filter((id) => id.trim().length > 0);
  let list = sorted.filter((c) => cardHasAllTagIds(c, tagIds));
  const cardExact = params.cardIdExact?.trim() ?? '';
  if (cardExact) {
    const one = list.find((c) => c.id === cardExact);
    list = one ? [one] : [];
  }
  return list.slice(params.offset, params.offset + params.limit);
}

export async function listCardsInCollection(
  collectionId: string,
  params: {
    offset: number;
    limit: number;
    selectedTagIds?: string[];
    cardIdExact?: string | null;
    advancedFilters?: import('../../components/gallery/galleryFilterTypes').GalleryAdvancedFilters;
    sort?: import('../../components/gallery/galleryFilterTypes').GallerySortState;
  }
): Promise<CardRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageListCards({
      offset: params.offset,
      limit: params.limit,
      selectedTagIds: params.selectedTagIds,
      cardIdExact: params.cardIdExact,
      collectionId,
      advancedFilters: params.advancedFilters,
      sort: params.sort
    });
  }
  const sorted = (await listCardsSorted('all')).filter((c) => c.collectionIds.includes(collectionId));
  const tagIds = (params.selectedTagIds ?? []).filter((id) => id.trim().length > 0);
  let list = sorted.filter((c) => cardHasAllTagIds(c, tagIds));
  const cardExact = params.cardIdExact?.trim() ?? '';
  if (cardExact) {
    const one = list.find((c) => c.id === cardExact);
    list = one ? [one] : [];
  }
  return list.slice(params.offset, params.offset + params.limit);
}

export async function getCardById(id: string): Promise<CardRecord | null> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageGetCard(id);
  }
  const all = await listCardsSorted('all');
  return all.find((c) => c.id === id) ?? null;
}

/** Число карточек в каждой коллекции (по всей библиотеке). */
export async function getCollectionCardCounts(): Promise<Record<string, number>> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageCollectionCounts();
  }
  const all = await listCardsSorted('all');
  const m: Record<string, number> = {};
  for (const c of all) {
    for (const colId of c.collectionIds) {
      m[colId] = (m[colId] ?? 0) + 1;
    }
  }
  return m;
}

/** До `limitPerCollection` последних по `addedAt` карточек на коллекцию (новые первыми). */
export async function getCollectionPreviewSlices(limitPerCollection = 3): Promise<Record<string, CardRecord[]>> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageCollectionPreviewSlices(limitPerCollection);
  }
  const all = await listCardsSorted('all');
  const { getAllCollections } = await import('./collections');
  const cols = await getAllCollections();
  const out: Record<string, CardRecord[]> = {};
  for (const col of cols) {
    out[col.id] = [];
  }
  for (const card of all) {
    for (const colId of card.collectionIds) {
      const bucket = out[colId];
      if (bucket && bucket.length < limitPerCollection) {
        bucket.push(card);
      }
    }
  }
  return out;
}

/** Карта метка → вес категории (один проход по категориям). */
async function buildTagIdToCategoryWeight(): Promise<Map<string, CategoryWeight>> {
  const { getAllCategories, getTagsByCategory } = await import('./categories');
  const cats = await getAllCategories();
  const map = new Map<string, CategoryWeight>();
  for (const cat of cats) {
    const tags = await getTagsByCategory(cat.id);
    for (const t of tags) {
      map.set(t.id, cat.weight);
    }
  }
  return map;
}

function scoreOverlapLex(
  baseTagIds: string[],
  candTagIds: string[],
  categoryWeightByTag: Map<string, CategoryWeight>
): { scoreHigh: number; scoreMedium: number; scoreLow: number } | null {
  const candSet = new Set(candTagIds);
  let scoreHigh = 0;
  let scoreMedium = 0;
  let scoreLow = 0;
  let passesGate = false;

  for (const tid of baseTagIds) {
    if (!candSet.has(tid)) continue;
    const w = categoryWeightByTag.get(tid);
    if (w === undefined || w === 'neutral') continue;
    const s = CATEGORY_WEIGHT_SCORE[w];
    if (w === 'high' || w === 'medium') passesGate = true;
    if (w === 'high') scoreHigh += s;
    else if (w === 'medium') scoreMedium += s;
    else if (w === 'low') scoreLow += s;
  }

  if (!passesGate) return null;
  return { scoreHigh, scoreMedium, scoreLow };
}

/**
 * Похожие изображения: метки из категорий с весом «Нулевой» не участвуют.
 * Кандидат допускается только при общей метке уровня «Высокий» или «Средний».
 * Ранжирование: лексикографически по суммам (высокий → средний → низкий), tie-break по дате добавления.
 */
export async function listSimilarCards(cardId: string, limit = 15): Promise<CardRecord[]> {
  const base = await getCardById(cardId);
  if (!base) return [];

  const categoryWeightByTag = await buildTagIdToCategoryWeight();

  const baseHasGateTier = base.tagIds.some((tid) => {
    const w = categoryWeightByTag.get(tid);
    return w === 'high' || w === 'medium';
  });
  if (!baseHasGateTier) return [];

  const all = await listCardsSorted('all');
  const scored: Array<{
    c: CardRecord;
    scoreHigh: number;
    scoreMedium: number;
    scoreLow: number;
  }> = [];

  for (const c of all) {
    if (c.id === cardId || c.type !== 'image') continue;
    const lex = scoreOverlapLex(base.tagIds, c.tagIds, categoryWeightByTag);
    if (!lex) continue;
    scored.push({ c, ...lex });
  }

  scored.sort((a, b) => {
    if (b.scoreHigh !== a.scoreHigh) return b.scoreHigh - a.scoreHigh;
    if (b.scoreMedium !== a.scoreMedium) return b.scoreMedium - a.scoreMedium;
    if (b.scoreLow !== a.scoreLow) return b.scoreLow - a.scoreLow;
    return b.c.addedAt.localeCompare(a.c.addedAt);
  });

  return scored.slice(0, limit).map((x) => x.c);
}

export async function insertImportedCards(newCards: CardRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageInsertCardsMetadata(
      newCards.map((c) => ({
        id: c.id,
        tagIds: c.tagIds,
        collectionIds: c.collectionIds,
        description: c.description,
        format: c.format,
        width: c.width,
        height: c.height,
        fileSize: c.fileSize,
        fileSizeMb: c.fileSizeMb,
        dateModified: c.dateModified
      }))
    );
    notifyCardsChanged();
    notifyTagsChanged();
    const n = newCards.length;
    void tryAppendLibraryHistory(n === 1 ? 'Импорт: добавлена 1 карточка' : `Импорт: добавлено ${n} карточек`);
    return;
  }
  const legacy = safeReadArray<{ id: string; type?: string }>(STORAGE_KEYS.cards);
  safeWriteArray(STORAGE_KEYS.cards, [...legacy, ...newCards.map((c) => ({ id: c.id, type: c.type }))]);
  notifyCardsChanged();
}

export async function updateCardPayload(
  cardId: string,
  patch: { tagIds?: string[]; collectionIds?: string[]; description?: string; name?: string; linkUrl?: string }
): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageUpdateCard(cardId, patch);
    notifyCardsChanged();
    notifyTagsChanged();
    return;
  }
  const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
    .map(normalizeCardRecord)
    .filter((c): c is CardRecord => c !== null);
  if (localCards.length > 0) {
    const next = localCards.map((c) => {
      if (c.id !== cardId) return c;
      const updated: CardRecord = {
        ...c,
        ...(patch.tagIds ? { tagIds: [...patch.tagIds] } : {}),
        ...(patch.collectionIds ? { collectionIds: [...patch.collectionIds] } : {})
      };
      if (patch.description !== undefined) {
        const trimmed = patch.description.trim();
        if (trimmed) updated.description = trimmed;
        else delete updated.description;
      }
      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (trimmed) updated.name = trimmed;
        else delete updated.name;
      }
      if (patch.linkUrl !== undefined) {
        const trimmed = patch.linkUrl.trim();
        if (trimmed) updated.linkUrl = trimmed;
        else delete updated.linkUrl;
      }
      return updated;
    });
    safeWriteArray(STORAGE_KEYS.cards, next);
  }
  notifyCardsChanged();
  notifyTagsChanged();
}

export async function softDeleteCard(cardId: string): Promise<void> {
  const b = await resolveBackend();

  if (b === 'file') {
    await storage.storageSoftDeleteCard(cardId);
    notifyMoodboardBoardChanged();
  } else {
    const legacy = safeReadArray<{ id: string; type?: string }>(STORAGE_KEYS.cards);
    safeWriteArray(
      STORAGE_KEYS.cards,
      legacy.filter((x) => x.id !== cardId)
    );
    const mb = safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard).filter((x) => x.id !== cardId);
    safeWriteArray(STORAGE_KEYS.moodboard, mb);
    const boardLs = readMoodboardBoardFromLocalStorage() ?? createEmptyMoodboardBoard();
    writeMoodboardBoardToLocalStorage(pruneMoodboardBoardForCard(boardLs, cardId));
    notifyMoodboardBoardChanged();
  }

  const deleted = historyCardAction('Удалена ', cardId);
  void tryAppendLibraryHistory(deleted.message, deleted.segments);
  notifyCardsChanged();
  notifyTagsChanged();
}

export async function restoreCard(cardId: string): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    await storage.storageRestoreCard(cardId);
  }
  const restored = historyCardAction('Восстановлена ', cardId);
  void tryAppendLibraryHistory(restored.message, restored.segments);
  notifyCardsChanged();
  notifyTagsChanged();
}

export async function permanentDeleteCard(cardId: string): Promise<void> {
  const b = await resolveBackend();

  if (b === 'file') {
    await storage.storagePermanentDeleteCard(cardId);
    notifyMoodboardBoardChanged();
  } else {
    const legacy = safeReadArray<{ id: string; type?: string }>(STORAGE_KEYS.cards);
    safeWriteArray(
      STORAGE_KEYS.cards,
      legacy.filter((x) => x.id !== cardId)
    );
    const mb = safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard).filter((x) => x.id !== cardId);
    safeWriteArray(STORAGE_KEYS.moodboard, mb);
    const boardLs = readMoodboardBoardFromLocalStorage() ?? createEmptyMoodboardBoard();
    writeMoodboardBoardToLocalStorage(pruneMoodboardBoardForCard(boardLs, cardId));
    notifyMoodboardBoardChanged();
  }

  void tryAppendLibraryHistory('Удалена карточка навсегда', [
    { kind: 'text', text: 'Удалена ' },
    { kind: 'entity', entityType: 'card', id: cardId, label: 'карточка' },
    { kind: 'text', text: ' навсегда' }
  ]);
  notifyCardsChanged();
  notifyTagsChanged();
}

export async function emptyTrash(): Promise<number> {
  const b = await resolveBackend();
  if (b !== 'file') return 0;
  const n = await storage.storageEmptyTrash();
  if (n > 0) {
    void tryAppendLibraryHistory(`Очищена корзина (${n})`);
  }
  notifyCardsChanged();
  notifyTagsChanged();
  notifyMoodboardBoardChanged();
  return n;
}

/** Мягкое удаление в корзину или навсегда — по настройке «Общие». */
export async function deleteCard(cardId: string): Promise<void> {
  if (getDeleteCardsUseTrash()) {
    return softDeleteCard(cardId);
  }
  return permanentDeleteCard(cardId);
}
