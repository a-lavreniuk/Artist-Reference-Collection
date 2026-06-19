import type { MoodboardBoardV1 } from '../arcSchema';
import { createEmptyMoodboardBoard, normalizeMoodboardBoard } from '../arcSchema';
import * as storage from '../storageClient';
import { resolveBackend, STORAGE_KEYS } from './backend';
import { cardHasAllTagIds, safeReadArray, safeWriteArray } from './internal';
import { notifyCardsChanged, notifyMoodboardBoardChanged } from './events';
import type { CardRecord } from '../arcSchema';

export function pruneMoodboardBoardForCard(board: MoodboardBoardV1, cardId: string): MoodboardBoardV1 {
  return {
    ...board,
    imageInstances: board.imageInstances.filter((i) => i.cardId !== cardId)
  };
}

export function readMoodboardBoardFromLocalStorage(): MoodboardBoardV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.moodboardBoard);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMoodboardBoard(parsed);
  } catch {
    return null;
  }
}

export function writeMoodboardBoardToLocalStorage(board: MoodboardBoardV1): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.moodboardBoard, JSON.stringify(board));
  } catch {
    /* ignore */
  }
}

export async function readMoodboardIdsUnified(): Promise<string[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    const mb = await storage.storageGetMoodboard();
    return [...mb.moodboardCardIds];
  }
  return safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard)
    .map((x) => x.id)
    .filter((id): id is string => typeof id === 'string');
}

async function persistMoodboardIds(ids: string[]): Promise<void> {
  const normalized = [...new Set(ids)];
  const b = await resolveBackend();
  if (b === 'file') {
    const mb = await storage.storageGetMoodboard();
    await storage.storageSaveMoodboard({ ...mb, moodboardCardIds: normalized });
    notifyCardsChanged();
    return;
  }
  safeWriteArray(
    STORAGE_KEYS.moodboard,
    normalized.map((id) => ({ id }))
  );
  notifyCardsChanged();
}

async function persistMoodboardBoardInternal(board: MoodboardBoardV1): Promise<void> {
  const normalized = normalizeMoodboardBoard(board);
  const b = await resolveBackend();
  if (b === 'file') {
    const mb = await storage.storageGetMoodboard();
    await storage.storageSaveMoodboard({ ...mb, moodboardBoard: normalized });
    notifyMoodboardBoardChanged();
    return;
  }
  writeMoodboardBoardToLocalStorage(normalized);
  notifyMoodboardBoardChanged();
}

export async function getMoodboardCardIds(): Promise<string[]> {
  return readMoodboardIdsUnified();
}

export async function isCardInMoodboard(cardId: string): Promise<boolean> {
  const ids = await readMoodboardIdsUnified();
  return ids.includes(cardId);
}

export async function addCardToMoodboard(cardId: string): Promise<void> {
  if (!cardId.trim()) return;
  const ids = await readMoodboardIdsUnified();
  if (ids.includes(cardId)) return;
  await persistMoodboardIds([...ids, cardId]);
}

export async function getMoodboardBoard(): Promise<MoodboardBoardV1> {
  const b = await resolveBackend();
  if (b === 'file') {
    const mb = await storage.storageGetMoodboard();
    if (mb.moodboardBoard) return normalizeMoodboardBoard(mb.moodboardBoard);
  }
  const fromLs = readMoodboardBoardFromLocalStorage();
  if (fromLs) return fromLs;
  return createEmptyMoodboardBoard();
}

export async function saveMoodboardBoard(board: MoodboardBoardV1): Promise<void> {
  await persistMoodboardBoardInternal(board);
}

export async function isCardOnBoard(cardId: string): Promise<boolean> {
  const board = await getMoodboardBoard();
  return board.imageInstances.some((i) => i.cardId === cardId);
}

export async function listMoodboardCards(params: {
  offset: number;
  limit: number;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  advancedFilters?: import('../../components/gallery/galleryFilterTypes').GalleryAdvancedFilters;
  sort?: import('../../components/gallery/galleryFilterTypes').GallerySortState;
}): Promise<CardRecord[]> {
  const mbIds = await readMoodboardIdsUnified();
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageListCards({
      offset: params.offset,
      limit: params.limit,
      selectedTagIds: params.selectedTagIds,
      cardIdExact: params.cardIdExact,
      moodboardCardIds: mbIds,
      advancedFilters: params.advancedFilters,
      sort: params.sort
    });
  }
  const mbSet = new Set(mbIds);
  const { listCardsSorted } = await import('./cards');
  const sorted = await listCardsSorted('all');
  let list = sorted.filter((c) => mbSet.has(c.id));
  const tagIds = (params.selectedTagIds ?? []).filter((id) => id.trim().length > 0);
  list = list.filter((c) => cardHasAllTagIds(c, tagIds));
  const cardExact = params.cardIdExact?.trim() ?? '';
  if (cardExact) {
    const one = list.find((c) => c.id === cardExact);
    list = one ? [one] : [];
  }
  return list.slice(params.offset, params.offset + params.limit);
}

export async function removeCardFromMoodboard(cardId: string): Promise<void> {
  const ids = await readMoodboardIdsUnified();
  if (!ids.includes(cardId)) return;
  await persistMoodboardIds(ids.filter((id) => id !== cardId));
  const board = await getMoodboardBoard();
  await persistMoodboardBoardInternal(pruneMoodboardBoardForCard(board, cardId));
}

export async function toggleCardInMoodboard(cardId: string): Promise<boolean> {
  const ids = await readMoodboardIdsUnified();
  if (ids.includes(cardId)) {
    await persistMoodboardIds(ids.filter((id) => id !== cardId));
    const board = await getMoodboardBoard();
    await persistMoodboardBoardInternal(pruneMoodboardBoardForCard(board, cardId));
    return false;
  }
  await persistMoodboardIds([...ids, cardId]);
  return true;
}
