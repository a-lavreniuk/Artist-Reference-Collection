import type { ArcMetadataV1 } from '../arcSchema';
import { normalizeMoodboardBoard } from '../arcSchema';
import * as storage from '../storageClient';
import {
  hasArcApi,
  persistCategories,
  persistTags,
  readCategoriesLocal,
  resolveBackend,
  resolveLibraryRoot,
  STORAGE_KEYS
} from './backend';
import {
  mapStorageTag,
  normalizeCardRecord,
  normalizeCategoryRecord,
  normalizeCollectionRecord,
  normalizeTagRecord,
  safeReadArray
} from './internal';
import { notifyCollectionsChanged } from './events';
import type { CategoryRecord, NavbarMetrics, TagRecord } from './types';
import type { CollectionRecord, CardRecord } from '../arcSchema';
import { getAllCategories } from './categories';
import { getAllCollections } from './collections';
import { listCardsSorted } from './cards';

export async function isLibraryConfigured(): Promise<boolean> {
  if (!hasArcApi()) return false;
  return Boolean(await resolveLibraryRoot());
}

export async function getNavbarMetrics(): Promise<NavbarMetrics> {
  const b = await resolveBackend();

  if (b === 'file') {
    const [totalCards, imageCards, videoCards, collections, moodboard, categories] = await Promise.all([
      storage.storageCountCards('all'),
      storage.storageCountCards('images'),
      storage.storageCountCards('videos'),
      storage.storageListCollections(),
      storage.storageGetMoodboard(),
      storage.storageListCategories()
    ]);
    return {
      totalCards,
      imageCards,
      videoCards,
      totalCollections: collections.length,
      moodboardCards: moodboard.moodboardCardIds.length,
      totalCategories: categories.length
    };
  }

  let cards: CardRecord[] = [];
  let collections: CollectionRecord[] = [];
  let moodboardIds: string[] = [];
  let categories: CategoryRecord[] = [];

  if (b === 'file') {
    /* handled above */
  } else {
    cards = safeReadArray<{ id: string; type?: string }>(STORAGE_KEYS.cards).map((raw, i) => ({
      id: typeof raw.id === 'string' ? raw.id : `c-${i}`,
      type: raw.type === 'video' ? ('video' as const) : ('image' as const),
      addedAt: new Date().toISOString(),
      originalRelativePath: 'legacy',
      thumbRelativePath: 'legacy',
      tagIds: [],
      collectionIds: []
    }));
    collections = safeReadArray<unknown>(STORAGE_KEYS.collections)
      .map(normalizeCollectionRecord)
      .filter((c): c is CollectionRecord => c !== null);
    moodboardIds = safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard)
      .map((x) => x.id)
      .filter((id): id is string => typeof id === 'string');
    categories = readCategoriesLocal();
  }

  const imageCards = cards.filter((card) => card.type === 'image').length;
  const videoCards = cards.filter((card) => card.type === 'video').length;

  return {
    totalCards: cards.length,
    imageCards,
    videoCards,
    totalCollections: collections.length,
    moodboardCards: moodboardIds.length,
    totalCategories: categories.length
  };
}

/** Снимок метаданных для проверки целостности (новый формат хранения). */
export async function loadLibraryMetadataSnapshot(): Promise<ArcMetadataV1 | null> {
  const b = await resolveBackend();
  if (b !== 'file') return null;
  const [categories, tagsRaw, cards, collections, moodboard] = await Promise.all([
    getAllCategories(),
    storage.storageListAllTags(),
    listCardsSorted('all'),
    getAllCollections(),
    storage.storageGetMoodboard()
  ]);
  const tags = tagsRaw.map(mapStorageTag);
  return {
    version: 1,
    categories,
    tags,
    cards,
    collections,
    moodboardCardIds: moodboard.moodboardCardIds,
    moodboardBoard: moodboard.moodboardBoard
      ? normalizeMoodboardBoard(moodboard.moodboardBoard)
      : undefined
  };
}

/** Применить автоисправления предупреждений целостности к новому хранилищу. */
export async function applyLibraryIntegrityFixes(fixed: ArcMetadataV1): Promise<void> {
  const b = await resolveBackend();
  if (b !== 'file') return;
  await persistCategories(
    fixed.categories.map((item, index) => normalizeCategoryRecord(item, index))
  );
  const tags: TagRecord[] = [];
  for (const item of fixed.tags) {
    const t = normalizeTagRecord(item);
    if (t) tags.push(t);
  }
  await persistTags(tags);
  const cols = fixed.collections
    .map(normalizeCollectionRecord)
    .filter((c): c is CollectionRecord => c !== null);
  const existingCols = await getAllCollections();
  const nextColIds = new Set(cols.map((c) => c.id));
  for (const col of cols) {
    await storage.storageUpsertCollection(col);
  }
  for (const col of existingCols) {
    if (!nextColIds.has(col.id)) await storage.storageDeleteCollection(col.id);
  }
  for (const raw of fixed.cards) {
    const c = normalizeCardRecord(raw);
    if (!c) continue;
    await storage.storageUpdateCard(c.id, {
      tagIds: c.tagIds,
      collectionIds: c.collectionIds,
      description: c.description
    });
  }
  await storage.storageSaveMoodboard({
    version: 1,
    moodboardCardIds: fixed.moodboardCardIds ?? [],
    moodboardBoard: fixed.moodboardBoard
  });
  notifyCollectionsChanged();
}
