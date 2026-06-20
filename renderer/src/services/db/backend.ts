import type { CategoryRecord, TagRecord } from './types';
import type { CollectionRecord } from '../arcSchema';
import * as storage from '../storageClient';
import {
  mapStorageTag,
  mapStorageTagToDb,
  normalizeCategoryRecord,
  normalizeCollectionRecord,
  normalizeTagRecord,
  safeReadArray,
  safeWriteArray
} from './internal';
import { notifyCategoriesChanged, notifyCollectionsChanged, notifyTagsChanged } from './events';

export const STORAGE_KEYS = {
  cards: 'arc.cards',
  collections: 'arc.collections',
  moodboard: 'arc.moodboard.cards',
  moodboardBoard: 'arc.moodboard.board',
  categories: 'arc.categories',
  tags: 'arc.tags'
} as const;

const LEGACY_STORAGE_KEY_PAIRS: Array<[string, string]> = [
  ['arc2.cards', STORAGE_KEYS.cards],
  ['arc2.collections', STORAGE_KEYS.collections],
  ['arc2.moodboard.cards', STORAGE_KEYS.moodboard],
  ['arc2.moodboard.board', STORAGE_KEYS.moodboardBoard],
  ['arc2.categories', STORAGE_KEYS.categories],
  ['arc2.tags', STORAGE_KEYS.tags],
  ['arc2.search.recentTagIds', 'arc.search.recentTagIds'],
  ['arc2.search.hasCompletedSearchSession', 'arc.search.hasCompletedSearchSession']
];

function migrateLegacyStorageKeys(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  for (const [legacyKey, nextKey] of LEGACY_STORAGE_KEY_PAIRS) {
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue === null) continue;
    if (window.localStorage.getItem(nextKey) === null) {
      window.localStorage.setItem(nextKey, legacyValue);
    }
    window.localStorage.removeItem(legacyKey);
  }
}

migrateLegacyStorageKeys();

export function hasArcApi(): boolean {
  return typeof window !== 'undefined' && typeof window.arc !== 'undefined';
}

import type { HistorySegment } from '../historyTypes';

export async function tryAppendLibraryHistory(message: string, segments?: HistorySegment[]): Promise<void> {
  if (!hasArcApi() || !window.arc?.appendHistoryLine) return;
  try {
    await window.arc.appendHistoryLine(message, segments);
  } catch {
    /* ignore */
  }
}

/** После смены пути библиотеки в настройках */
let cachedLibraryRoot: string | null | undefined;

export function invalidateLibraryCache(): void {
  fileBackendResolved = false;
  cachedLibraryRoot = undefined;
  tagsLoadPromise = null;
}

export let fileBackendResolved = false;

let backendInitPromise: Promise<'file' | 'local'> | null = null;
let tagsLoadPromise: Promise<TagRecord[]> | null = null;

export async function resolveLibraryRoot(): Promise<string | null> {
  if (!hasArcApi()) return null;
  if (cachedLibraryRoot === undefined) {
    cachedLibraryRoot = (await window.arc!.getLibraryPath()) ?? null;
  }
  return cachedLibraryRoot;
}

async function initFileBackendOnce(): Promise<'file' | 'local'> {
  const root = await resolveLibraryRoot();
  if (!root) {
    fileBackendResolved = true;
    return 'local';
  }
  await storage.storageEnsureReady();
  await migrateLocalIntoStorageIfNeeded();
  fileBackendResolved = true;
  return 'file';
}

export async function resolveBackend(): Promise<'file' | 'local'> {
  if (!hasArcApi()) {
    fileBackendResolved = true;
    return 'local';
  }
  if (fileBackendResolved) {
    const root = await resolveLibraryRoot();
    return root ? 'file' : 'local';
  }
  if (!backendInitPromise) {
    backendInitPromise = initFileBackendOnce().finally(() => {
      backendInitPromise = null;
    });
  }
  return backendInitPromise;
}

async function migrateLocalIntoStorageIfNeeded(): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage?.getItem('arc.storage.localHydrated') === '1') {
    return;
  }
  const cats = await storage.storageListCategories();
  const tags = await storage.storageListAllTags();
  if (cats.length > 0 || tags.length > 0) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('arc.storage.localHydrated', '1');
    }
    return;
  }

  const lsCats = safeReadArray<unknown>(STORAGE_KEYS.categories);
  const lsTags = safeReadArray<unknown>(STORAGE_KEYS.tags);
  if (lsCats.length === 0 && lsTags.length === 0) return;

  for (const [index, item] of lsCats.entries()) {
    const c = normalizeCategoryRecord(item, index);
    await storage.storageUpsertCategory(c);
  }
  for (const item of lsTags) {
    const t = normalizeTagRecord(item);
    if (t) await storage.storageUpsertTag(mapStorageTagToDb(t));
  }

  const lsCols = safeReadArray<unknown>(STORAGE_KEYS.collections);
  for (const item of lsCols) {
    const col = normalizeCollectionRecord(item);
    if (col) await storage.storageUpsertCollection(col);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('arc.storage.localHydrated', '1');
  }
}

export function readCategoriesLocal(): CategoryRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.categories);
  return raw.map((item, index) => normalizeCategoryRecord(item, index));
}

export function migrateCategoriesIfNeededLocal(list: CategoryRecord[]): void {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.categories);
  if (!Array.isArray(raw) || raw.length !== list.length) {
    safeWriteArray(STORAGE_KEYS.categories, list);
    return;
  }
  let needs = false;
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i];
    if (!o || typeof o !== 'object') {
      needs = true;
      break;
    }
    const rec = o as Record<string, unknown>;
    if (typeof rec.colorHex !== 'string' || typeof rec.weight !== 'string' || typeof rec.sortIndex !== 'number') {
      needs = true;
      break;
    }
  }
  if (needs) {
    safeWriteArray(STORAGE_KEYS.categories, list);
  }
}

export function readTagsLocal(): TagRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.tags);
  const out: TagRecord[] = [];
  for (const item of raw) {
    const t = normalizeTagRecord(item);
    if (t) out.push(t);
  }
  return out;
}

export async function readCategoriesUnified(): Promise<CategoryRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageListCategories();
  }
  const list = readCategoriesLocal();
  migrateCategoriesIfNeededLocal(list);
  return list;
}

export async function persistCategories(list: CategoryRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    const prev = await storage.storageListCategories();
    const prevIds = new Set(prev.map((c) => c.id));
    const nextIds = new Set(list.map((c) => c.id));
    for (const cat of list) {
      await storage.storageUpsertCategory(cat);
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) await storage.storageDeleteCategory(id);
    }
    notifyCategoriesChanged();
    return;
  }
  safeWriteArray(STORAGE_KEYS.categories, list);
  notifyCategoriesChanged();
}

export async function persistTags(list: TagRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    const prev = await storage.storageListAllTags();
    const prevIds = new Set(prev.map((t) => t.id));
    const nextIds = new Set(list.map((t) => t.id));
    for (const tag of list) {
      await storage.storageUpsertTag(mapStorageTagToDb(tag));
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) await storage.storageDeleteTag(id);
    }
    tagsLoadPromise = null;
    notifyTagsChanged();
    return;
  }
  safeWriteArray(STORAGE_KEYS.tags, list);
  notifyTagsChanged();
}

export async function readTagsUnified(): Promise<TagRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    if (!tagsLoadPromise) {
      tagsLoadPromise = storage.storageListAllTags().then((raw) => raw.map(mapStorageTag));
    }
    return tagsLoadPromise;
  }
  return readTagsLocal();
}

export function readCollectionsLocal(): CollectionRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.collections);
  return raw
    .map((item, index) => normalizeCollectionRecord(item, index))
    .filter((c): c is CollectionRecord => c !== null);
}

export function migrateCollectionsIfNeededLocal(list: CollectionRecord[]): void {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.collections);
  const needsSort = raw.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return typeof (item as Record<string, unknown>).sortIndex !== 'number';
  });
  if (!needsSort) return;
  const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, 'ru'));
  const next = sorted.map((c, index) => ({ ...c, sortIndex: index }));
  safeWriteArray(STORAGE_KEYS.collections, next);
}

export async function readCollectionsUnified(): Promise<CollectionRecord[]> {
  const b = await resolveBackend();
  if (b === 'file') {
    return storage.storageListCollections();
  }
  const list = readCollectionsLocal();
  migrateCollectionsIfNeededLocal(list);
  return readCollectionsLocal();
}

export async function persistCollections(list: CollectionRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file') {
    const prev = await storage.storageListCollections();
    const prevIds = new Set(prev.map((c) => c.id));
    const nextIds = new Set(list.map((c) => c.id));
    for (const id of prevIds) {
      if (!nextIds.has(id)) await storage.storageDeleteCollection(id);
    }
    for (const col of list) {
      await storage.storageUpsertCollection(col);
    }
    notifyCollectionsChanged();
    return;
  }
  safeWriteArray(STORAGE_KEYS.collections, list);
  notifyCollectionsChanged();
}
