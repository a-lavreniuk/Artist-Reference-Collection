import type { LibraryScope } from '../search/libraryScopeUrl';
import type {
  GalleryAdvancedFilters,
  GalleryFilterPresetPayload,
  GalleryFilterStats,
  GallerySortState,
  SavedFilterPreset
} from '../components/gallery/galleryFilterTypes';
import type { CardRecord, CollectionRecord, MoodboardBoardV1 } from './arcSchema';
import type { CategoryRecord, TagRecord } from './db';

export type StorageListCardsParams = {
  offset: number;
  limit: number;
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters?: GalleryAdvancedFilters;
  sort?: GallerySortState;
};

function arc() {
  if (!window.arc) throw new Error('API недоступен');
  return window.arc;
}

export async function storageEnsureReady(): Promise<void> {
  const res = await arc().storageEnsureReady();
  if (!res.ok) throw new Error(res.error ?? 'Библиотека не готова');
}

export async function storageListCards(params: StorageListCardsParams): Promise<CardRecord[]> {
  return arc().storageListCards(params);
}

export async function storageGetCard(cardId: string): Promise<CardRecord | null> {
  return arc().storageGetCard(cardId);
}

export async function storageUpdateCard(
  cardId: string,
  patch: { tagIds?: string[]; collectionIds?: string[]; description?: string; name?: string; linkUrl?: string }
): Promise<void> {
  return arc().storageUpdateCard(cardId, patch);
}

export async function storageInsertCardsMetadata(
  cards: Array<{
    id: string;
    tagIds: string[];
    collectionIds: string[];
    description?: string;
    format?: string;
    width?: number;
    height?: number;
    fileSize?: number;
    fileSizeMb?: number;
    dateModified?: string;
  }>
): Promise<void> {
  return arc().storageInsertCardsMetadata(cards);
}

export async function storageSoftDeleteCard(cardId: string): Promise<void> {
  return arc().storageSoftDeleteCard(cardId);
}

export async function storageRestoreCard(cardId: string): Promise<void> {
  return arc().storageRestoreCard(cardId);
}

export async function storagePermanentDeleteCard(cardId: string): Promise<void> {
  return arc().storagePermanentDeleteCard(cardId);
}

export async function storageEmptyTrash(): Promise<number> {
  return arc().storageEmptyTrash();
}

/** @deprecated Используйте storageSoftDeleteCard */
export async function storageDeleteCard(cardId: string): Promise<void> {
  return arc().storageDeleteCard(cardId);
}

export async function storageCountCards(
  filter: 'all' | 'images' | 'videos',
  libraryScope: LibraryScope = 'all'
): Promise<number> {
  return arc().storageCountCards({ filter, libraryScope });
}

export async function storageListCategories(): Promise<CategoryRecord[]> {
  return arc().storageListCategories();
}

export async function storageUpsertCategory(cat: CategoryRecord): Promise<void> {
  return arc().storageUpsertCategory(cat);
}

export async function storageDeleteCategory(id: string): Promise<void> {
  return arc().storageDeleteCategory(id);
}

export async function storageListTagsByCategory(categoryId: string): Promise<TagRecord[]> {
  return arc().storageListTagsByCategory(categoryId);
}

export async function storageListAllTags(): Promise<TagRecord[]> {
  return arc().storageListAllTags();
}

export async function storageUpsertTag(tag: TagRecord): Promise<void> {
  return arc().storageUpsertTag(tag);
}

export async function storageDeleteTag(tagId: string): Promise<void> {
  return arc().storageDeleteTag(tagId);
}

export async function storageListCollections(): Promise<CollectionRecord[]> {
  return arc().storageListCollections();
}

export async function storageUpsertCollection(col: CollectionRecord): Promise<void> {
  return arc().storageUpsertCollection(col);
}

export async function storageDeleteCollection(id: string): Promise<void> {
  return arc().storageDeleteCollection(id);
}

export async function storageCollectionCounts(): Promise<Record<string, number>> {
  return arc().storageCollectionCounts();
}

export async function storageCollectionStats(
  collectionId: string
): Promise<{ cardCount: number; totalSizeMb: number; createdAt: string } | null> {
  return arc().storageCollectionStats(collectionId);
}

export async function storageGetMoodboard(): Promise<{
  version: 1;
  moodboardCardIds: string[];
  moodboardBoard?: MoodboardBoardV1;
}> {
  return arc().storageGetMoodboard();
}

export async function storageSaveMoodboard(data: {
  version: 1;
  moodboardCardIds: string[];
  moodboardBoard?: MoodboardBoardV1;
}): Promise<void> {
  return arc().storageSaveMoodboard(data);
}

export async function storageGetSystem(): Promise<{
  duplicateSimilarityThresholdPct: number;
} | null> {
  return arc().storageGetSystem();
}

export async function storageSaveSystem(data: {
  version: 1;
  schemaVersion: number;
  duplicateSimilarityThresholdPct: number;
}): Promise<void> {
  return arc().storageSaveSystem(data);
}

export async function storageSkippedPairs(): Promise<[string, string][]> {
  return arc().storageSkippedPairs();
}

export async function storageAddSkippedPair(idA: string, idB: string): Promise<void> {
  return arc().storageAddSkippedPair(idA, idB);
}

export async function storageCardsPhash(): Promise<
  Array<{ id: string; phash: { rotHashes: [string, string, string, string]; hist: number[] } }>
> {
  return arc().storageCardsPhash();
}

export async function storageGalleryFilterStats(payload: {
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
}): Promise<GalleryFilterStats | null> {
  return arc().storageGalleryFilterStats(payload);
}

export async function storageListFilterPresets(): Promise<SavedFilterPreset[]> {
  return arc().storageListFilterPresets();
}

export async function storageUpsertFilterPreset(
  id: string,
  name: string,
  payload: GalleryFilterPresetPayload
): Promise<void> {
  return arc().storageUpsertFilterPreset({ id, name, payload });
}

export async function storageDeleteFilterPreset(id: string): Promise<void> {
  return arc().storageDeleteFilterPreset(id);
}

export async function storageRenameFilterPreset(id: string, name: string): Promise<void> {
  return arc().storageRenameFilterPreset({ id, name });
}

export async function storageBackfillDuration(): Promise<{ updated: number; failed: number }> {
  return arc().storageBackfillDuration();
}
