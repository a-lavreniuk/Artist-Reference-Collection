import type { ArcMetadataV1, CardRecord, CollectionRecord, MoodboardBoardV1 } from './arcSchema';
import { createEmptyMoodboardBoard, normalizeMoodboardBoard } from './arcSchema';
import { normalizeHex } from '../utils/colorPicker';

export type NavbarMetrics = {
  totalCards: number;
  imageCards: number;
  videoCards: number;
  totalCollections: number;
  moodboardCards: number;
  totalCategories: number;
};

export type CategoryWeight = 'neutral' | 'low' | 'medium' | 'high';

/** Числовой вклад метки в скоринг «похожих» (одно место для настройки). */
export const CATEGORY_WEIGHT_SCORE: Record<CategoryWeight, number> = {
  neutral: 1,
  low: 2,
  medium: 4,
  high: 8
};

export type CategoryRecord = {
  id: string;
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  sortIndex: number;
  createdAt: string;
};

export type TagRecord = {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  tooltipImageDataUrl?: string;
};

export type { CardRecord, CollectionRecord } from './arcSchema';

const STORAGE_KEYS = {
  cards: 'arc.cards',
  collections: 'arc.collections',
  moodboard: 'arc.moodboard.cards',
  moodboardBoard: 'arc.moodboard.board',
  categories: 'arc.categories',
  tags: 'arc.tags'
} as const;

export const ARC_CATEGORIES_CHANGED_EVENT = 'arc:categories-changed';
export const ARC_TAGS_CHANGED_EVENT = 'arc:tags-changed';
export const ARC_CARDS_CHANGED_EVENT = 'arc:cards-changed';
export const ARC_COLLECTIONS_CHANGED_EVENT = 'arc:collections-changed';
export const ARC_MOODBOARD_BOARD_CHANGED_EVENT = 'arc:moodboard-board-changed';

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

function hasArcApi(): boolean {
  return typeof window !== 'undefined' && typeof window.arc !== 'undefined';
}

async function tryAppendLibraryHistory(message: string): Promise<void> {
  if (!hasArcApi() || !window.arc?.appendHistoryLine) return;
  try {
    await window.arc.appendHistoryLine(message);
  } catch {
    /* ignore */
  }
}

/** После смены пути библиотеки в настройках */
export function invalidateLibraryCache(): void {
  metadataBlob = null;
  fileBackendResolved = false;
}

let metadataBlob: ArcMetadataV1 | null = null;
let fileBackendResolved = false;

function emptyMetadata(): ArcMetadataV1 {
  return {
    version: 1,
    categories: [],
    tags: [],
    cards: [],
    collections: [],
    moodboardCardIds: []
  };
}

async function resolveBackend(): Promise<'file' | 'local'> {
  if (!hasArcApi()) {
    fileBackendResolved = true;
    return 'local';
  }
  if (fileBackendResolved && metadataBlob) {
    return 'file';
  }
  if (fileBackendResolved && !metadataBlob) {
    return 'local';
  }

  const root = await window.arc!.getLibraryPath();
  if (!root) {
    fileBackendResolved = true;
    metadataBlob = null;
    return 'local';
  }

  let raw = await window.arc!.readMetadata();
  if (!raw) {
    raw = emptyMetadata();
  }
  metadataBlob = raw as ArcMetadataV1;
  normalizeMetadataShape(metadataBlob);
  await migrateLocalIntoFileIfNeeded();
  fileBackendResolved = true;
  return 'file';
}

function normalizeMetadataShape(meta: ArcMetadataV1): void {
  if (!Array.isArray(meta.categories)) meta.categories = [];
  if (!Array.isArray(meta.tags)) meta.tags = [];
  if (!Array.isArray(meta.cards)) meta.cards = [];
  if (!Array.isArray(meta.collections)) meta.collections = [];
  if (!Array.isArray(meta.moodboardCardIds)) meta.moodboardCardIds = [];
  if (typeof meta.duplicateSimilarityThresholdPct !== 'number' || !Number.isFinite(meta.duplicateSimilarityThresholdPct)) {
    meta.duplicateSimilarityThresholdPct = 85;
  } else {
    meta.duplicateSimilarityThresholdPct = Math.min(100, Math.max(50, meta.duplicateSimilarityThresholdPct));
  }
  if (!Array.isArray(meta.skippedDuplicatePairs)) meta.skippedDuplicatePairs = [];
  else {
    meta.skippedDuplicatePairs = meta.skippedDuplicatePairs
      .filter((x): x is [string, string] => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string')
      .map(([a, b]) => (a < b ? [a, b] : [b, a]) as [string, string]);
  }
  if (meta.moodboardBoard !== undefined && meta.moodboardBoard !== null) {
    meta.moodboardBoard = normalizeMoodboardBoard(meta.moodboardBoard);
  }
}

async function persistBlob(): Promise<void> {
  if (!hasArcApi() || !metadataBlob) return;
  await window.arc!.writeMetadata(metadataBlob);
}

async function migrateLocalIntoFileIfNeeded(): Promise<void> {
  if (!metadataBlob || !hasArcApi()) return;

  const fileCatsEmpty = metadataBlob.categories.length === 0;
  const fileTagsEmpty = metadataBlob.tags.length === 0;
  const lsCats = safeReadArray<unknown>(STORAGE_KEYS.categories);
  const lsTags = safeReadArray<unknown>(STORAGE_KEYS.tags);

  if (!(fileCatsEmpty && fileTagsEmpty)) return;
  if (lsCats.length === 0 && lsTags.length === 0) return;

  metadataBlob.categories = lsCats;
  metadataBlob.tags = lsTags;

  const lsCols = safeReadArray<unknown>(STORAGE_KEYS.collections);
  if (metadataBlob.collections.length === 0 && lsCols.length > 0) {
    metadataBlob.collections = lsCols
      .map((c) => normalizeCollectionRecord(c))
      .filter((c): c is CollectionRecord => c !== null);
  }

  const lsMb = safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard);
  if (metadataBlob.moodboardCardIds.length === 0 && lsMb.length > 0) {
    metadataBlob.moodboardCardIds = lsMb.map((x) => x.id).filter((id): id is string => typeof id === 'string');
  }

  if (!metadataBlob.moodboardBoard) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.moodboardBoard);
      if (raw) {
        metadataBlob.moodboardBoard = normalizeMoodboardBoard(JSON.parse(raw) as unknown);
      }
    } catch {
      /* ignore */
    }
  }

  recomputeTagUsageCounts();

  await persistBlob();

  try {
    window.localStorage.removeItem(STORAGE_KEYS.categories);
    window.localStorage.removeItem(STORAGE_KEYS.tags);
    window.localStorage.removeItem(STORAGE_KEYS.cards);
    window.localStorage.removeItem(STORAGE_KEYS.collections);
    window.localStorage.removeItem(STORAGE_KEYS.moodboard);
    window.localStorage.removeItem(STORAGE_KEYS.moodboardBoard);
  } catch {
    /* ignore */
  }
}

function notifyCardsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_CARDS_CHANGED_EVENT));
}

function notifyCollectionsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_COLLECTIONS_CHANGED_EVENT));
}

function notifyMoodboardBoardChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_MOODBOARD_BOARD_CHANGED_EVENT));
}

function pruneMoodboardBoardForCard(board: MoodboardBoardV1, cardId: string): MoodboardBoardV1 {
  return {
    ...board,
    imageInstances: board.imageInstances.filter((i) => i.cardId !== cardId)
  };
}

function readMoodboardBoardFromLocalStorage(): MoodboardBoardV1 | null {
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

function writeMoodboardBoardToLocalStorage(board: MoodboardBoardV1): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.moodboardBoard, JSON.stringify(board));
  } catch {
    /* ignore */
  }
}

function safeReadArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeWriteArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseWeight(v: unknown): CategoryWeight {
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'neutral') {
    return v;
  }
  return 'neutral';
}

function normalizeNameForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCategoryRecord(item: unknown, index: number): CategoryRecord {
  const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const id = typeof r.id === 'string' ? r.id : newId();
  const name = typeof r.name === 'string' ? r.name : '';
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString();
  let colorHex = '#EAB308';
  if (typeof r.colorHex === 'string') {
    const n = normalizeHex(r.colorHex);
    if (n) colorHex = n;
  }
  const weight = parseWeight(r.weight);
  const sortIndex = typeof r.sortIndex === 'number' ? r.sortIndex : index;
  return { id, name, colorHex, weight, sortIndex, createdAt };
}

function readCategoriesLocal(): CategoryRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.categories);
  return raw.map((item, index) => normalizeCategoryRecord(item, index));
}

function migrateCategoriesIfNeededLocal(list: CategoryRecord[]): void {
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

function normalizeTagRecord(item: unknown): TagRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : newId();
  const categoryId = typeof r.categoryId === 'string' ? r.categoryId : '';
  const name = typeof r.name === 'string' ? r.name : '';
  if (!categoryId || !name) return null;
  const usageCount = typeof r.usageCount === 'number' ? r.usageCount : 0;
  let description: string | undefined;
  if (typeof r.description === 'string' && r.description.trim()) {
    description = r.description.trim();
  }
  let tooltipImageDataUrl: string | undefined;
  if (typeof r.tooltipImageDataUrl === 'string' && r.tooltipImageDataUrl.startsWith('data:image/')) {
    tooltipImageDataUrl = r.tooltipImageDataUrl;
  }
  return {
    id,
    categoryId,
    name,
    usageCount,
    ...(description ? { description } : {}),
    ...(tooltipImageDataUrl ? { tooltipImageDataUrl } : {})
  };
}

function readTagsLocal(): TagRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.tags);
  const out: TagRecord[] = [];
  for (const item of raw) {
    const t = normalizeTagRecord(item);
    if (t) out.push(t);
  }
  return out;
}

async function readCategoriesUnified(): Promise<CategoryRecord[]> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    return metadataBlob.categories.map((item, index) => normalizeCategoryRecord(item, index));
  }
  const list = readCategoriesLocal();
  migrateCategoriesIfNeededLocal(list);
  return list;
}

async function persistCategories(list: CategoryRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.categories = list;
    await persistBlob();
    notifyCategoriesChanged();
    return;
  }
  safeWriteArray(STORAGE_KEYS.categories, list);
  notifyCategoriesChanged();
}

async function persistTags(list: TagRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.tags = list;
    recomputeTagUsageCounts();
    await persistBlob();
    notifyTagsChanged();
    return;
  }
  safeWriteArray(STORAGE_KEYS.tags, list);
  notifyTagsChanged();
}

function tagsFromBlob(): TagRecord[] {
  if (!metadataBlob) return [];
  const out: TagRecord[] = [];
  for (const item of metadataBlob.tags) {
    const t = normalizeTagRecord(item);
    if (t) out.push(t);
  }
  return out;
}

async function readTagsUnified(): Promise<TagRecord[]> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    return tagsFromBlob();
  }
  return readTagsLocal();
}

function recomputeTagUsageCounts(): void {
  if (!metadataBlob) return;
  const tags = tagsFromBlob();
  const counts = new Map<string, number>();
  for (const card of metadataBlob.cards) {
    for (const tid of card.tagIds) {
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
  }
  metadataBlob.tags = tags.map((t) => ({ ...t, usageCount: counts.get(t.id) ?? 0 }));
}

function normalizeCardRecord(item: unknown): CardRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const type = r.type === 'video' ? 'video' : 'image';
  const addedAt = typeof r.addedAt === 'string' ? r.addedAt : new Date().toISOString();
  const originalRelativePath = typeof r.originalRelativePath === 'string' ? r.originalRelativePath : '';
  const thumbRelativePath =
    typeof r.thumbRelativePath === 'string' ? r.thumbRelativePath : originalRelativePath;
  if (!id || !originalRelativePath) return null;
  const tagIds = Array.isArray(r.tagIds)
    ? r.tagIds.filter((x): x is string => typeof x === 'string')
    : [];
  const collectionIds = Array.isArray(r.collectionIds)
    ? r.collectionIds.filter((x): x is string => typeof x === 'string')
    : [];
  const fileSize = typeof r.fileSize === 'number' ? r.fileSize : undefined;
  const fileSizeMb = typeof r.fileSizeMb === 'number' && Number.isFinite(r.fileSizeMb) ? r.fileSizeMb : undefined;
  const format = typeof r.format === 'string' && r.format.trim() ? r.format.trim().toLowerCase() : undefined;
  const dateModified =
    typeof r.dateModified === 'string' && r.dateModified.trim() ? r.dateModified : undefined;
  const width = typeof r.width === 'number' && Number.isFinite(r.width) ? r.width : undefined;
  const height = typeof r.height === 'number' && Number.isFinite(r.height) ? r.height : undefined;
  const description =
    typeof r.description === 'string' && r.description.trim() ? String(r.description).trim() : undefined;
  return {
    id,
    type,
    addedAt,
    originalRelativePath,
    thumbRelativePath,
    tagIds,
    collectionIds,
    ...(format ? { format } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(description ? { description } : {}),
    ...(fileSize !== undefined ? { fileSize } : {}),
    ...(fileSizeMb !== undefined ? { fileSizeMb } : {})
  };
}

function normalizeCollectionRecord(item: unknown): CollectionRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString();
  if (!id) return null;
  return { id, name: name || 'Без названия', createdAt };
}

export async function isLibraryConfigured(): Promise<boolean> {
  if (!hasArcApi()) return false;
  const root = await window.arc!.getLibraryPath();
  return Boolean(root);
}

export async function getNavbarMetrics(): Promise<NavbarMetrics> {
  const b = await resolveBackend();
  let cards: CardRecord[] = [];
  let collections: CollectionRecord[] = [];
  let moodboardIds: string[] = [];
  let categories: CategoryRecord[] = [];

  if (b === 'file' && metadataBlob) {
    cards = metadataBlob.cards.map(normalizeCardRecord).filter((c): c is CardRecord => c !== null);
    collections = metadataBlob.collections
      .map(normalizeCollectionRecord)
      .filter((c): c is CollectionRecord => c !== null);
    moodboardIds = [...metadataBlob.moodboardCardIds];
    categories = metadataBlob.categories.map((item, index) => normalizeCategoryRecord(item, index));
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

export async function getAllCategories(): Promise<CategoryRecord[]> {
  const list = await readCategoriesUnified();
  const b = await resolveBackend();
  if (b === 'local') {
    migrateCategoriesIfNeededLocal(list);
  }
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru'));
}

export async function addCategory(name: string, colorHex: string): Promise<CategoryRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название категории не может быть пустым');
  }
  const hex = normalizeHex(colorHex) ?? '#EAB308';
  const list = await readCategoriesUnified();
  if (list.some((c) => normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Категория с таким названием уже есть');
  }
  const maxSort = list.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const created: CategoryRecord = {
    id: newId(),
    name: trimmed,
    colorHex: hex,
    weight: 'neutral',
    sortIndex: maxSort + 1,
    createdAt: new Date().toISOString()
  };
  await persistCategories([...list, created]);
  return created;
}

export async function updateCategoryName(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название не может быть пустым');
  }
  const list = await readCategoriesUnified();
  if (list.some((c) => c.id !== id && normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Категория с таким названием уже есть');
  }
  await persistCategories(list.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  notifyCategoriesChanged();
}

export async function updateCategoryColorHex(id: string, colorHex: string): Promise<void> {
  const hex = normalizeHex(colorHex);
  if (!hex) {
    throw new Error('Некорректный цвет');
  }
  const list = await readCategoriesUnified();
  await persistCategories(list.map((c) => (c.id === id ? { ...c, colorHex: hex } : c)));
  notifyCategoriesChanged();
}

export async function updateCategoryWeight(id: string, weight: CategoryWeight): Promise<void> {
  const list = await readCategoriesUnified();
  await persistCategories(list.map((c) => (c.id === id ? { ...c, weight } : c)));
  notifyCategoriesChanged();
}

export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  const sorted = [...(await getAllCategories())];
  const index = sorted.findIndex((c) => c.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) {
    return;
  }
  const a = sorted[index];
  const b = sorted[swapIndex];
  const list = (await readCategoriesUnified()).map((c) => {
    if (c.id === a.id) return { ...c, sortIndex: b.sortIndex };
    if (c.id === b.id) return { ...c, sortIndex: a.sortIndex };
    return c;
  });
  await persistCategories(list);
  notifyCategoriesChanged();
}

export async function deleteCategory(id: string): Promise<void> {
  const tags = (await readTagsUnified()).filter((t) => t.categoryId !== id);
  await persistTags(tags);
  await persistCategories((await readCategoriesUnified()).filter((c) => c.id !== id));
  notifyTagsChanged();
  notifyCategoriesChanged();
}

export async function getTagsByCategory(categoryId: string): Promise<TagRecord[]> {
  return (await readTagsUnified())
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function addTag(
  categoryId: string,
  name: string,
  extras?: { description?: string; tooltipImageDataUrl?: string }
): Promise<TagRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название метки не может быть пустым');
  }
  if (!(await readCategoriesUnified()).some((c) => c.id === categoryId)) {
    throw new Error('Категория не найдена');
  }
  const tags = await readTagsUnified();
  const dup = tags.some((t) => normalizeNameForCompare(t.name) === normalizeNameForCompare(trimmed));
  if (dup) {
    throw new Error('Метка с таким названием уже есть');
  }
  const desc = extras?.description?.trim();
  const img = extras?.tooltipImageDataUrl;
  const created: TagRecord = {
    id: newId(),
    categoryId,
    name: trimmed,
    usageCount: 0,
    ...(desc ? { description: desc } : {}),
    ...(img && img.startsWith('data:image/') ? { tooltipImageDataUrl: img } : {})
  };
  await persistTags([...tags, created]);
  return created;
}

export async function updateTag(
  tagId: string,
  patch: {
    name: string;
    categoryId: string;
    description?: string;
    tooltipImageDataUrl?: string;
  }
): Promise<void> {
  const tags = await readTagsUnified();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) {
    throw new Error('Метка не найдена');
  }
  if (!(await readCategoriesUnified()).some((c) => c.id === patch.categoryId)) {
    throw new Error('Категория не найдена');
  }
  const trimmed = patch.name.trim();
  if (!trimmed) {
    throw new Error('Название метки не может быть пустым');
  }
  if (tags.some((t) => t.id !== tagId && normalizeNameForCompare(t.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Метка с таким названием уже есть');
  }
  const next: TagRecord = {
    ...tag,
    name: trimmed,
    categoryId: patch.categoryId,
    usageCount: tag.usageCount
  };
  const desc = patch.description?.trim();
  if (desc) {
    next.description = desc;
  } else {
    delete next.description;
  }
  if (patch.tooltipImageDataUrl && patch.tooltipImageDataUrl.startsWith('data:image/')) {
    next.tooltipImageDataUrl = patch.tooltipImageDataUrl;
  } else {
    delete next.tooltipImageDataUrl;
  }
  await persistTags(tags.map((t) => (t.id === tagId ? next : t)));
  notifyTagsChanged();
}

export async function deleteTag(tagId: string): Promise<void> {
  const tags = await readTagsUnified();
  const removed = tags.find((t) => t.id === tagId);
  if (!removed) {
    throw new Error('Метка не найдена');
  }
  await persistTags(tags.filter((t) => t.id !== tagId));
  if (metadataBlob) {
    metadataBlob.cards = metadataBlob.cards.map((c) => ({
      ...c,
      tagIds: c.tagIds.filter((id) => id !== tagId)
    }));
    await persistBlob();
  }
  notifyTagsChanged();
  notifyCardsChanged();
  void tryAppendLibraryHistory(`Удалена метка «${removed.name}»`);
}

export async function getDuplicateSimilarityThresholdPct(): Promise<number> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    normalizeMetadataShape(metadataBlob);
    return metadataBlob.duplicateSimilarityThresholdPct ?? 85;
  }
  return 85;
}

export async function setDuplicateSimilarityThresholdPct(pct: number): Promise<void> {
  const b = await resolveBackend();
  if (b !== 'file' || !metadataBlob) return;
  normalizeMetadataShape(metadataBlob);
  metadataBlob.duplicateSimilarityThresholdPct = Math.min(100, Math.max(50, pct));
  await persistBlob();
}

export async function addSkippedDuplicatePair(idA: string, idB: string): Promise<void> {
  const b = await resolveBackend();
  if (b !== 'file' || !metadataBlob) return;
  normalizeMetadataShape(metadataBlob);
  const pair: [string, string] = idA < idB ? [idA, idB] : [idB, idA];
  const cur = [...(metadataBlob.skippedDuplicatePairs ?? [])];
  if (!cur.some(([x, y]) => x === pair[0] && y === pair[1])) {
    cur.push(pair);
  }
  metadataBlob.skippedDuplicatePairs = cur;
  await persistBlob();
}

export async function moveTagToCategory(tagId: string, targetCategoryId: string): Promise<void> {
  const categories = await readCategoriesUnified();
  if (!categories.some((c) => c.id === targetCategoryId)) {
    throw new Error('Категория не найдена');
  }
  const tags = await readTagsUnified();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) {
    throw new Error('Метка не найдена');
  }
  if (tag.categoryId === targetCategoryId) {
    return;
  }
  await persistTags(tags.map((t) => (t.id === tagId ? { ...t, categoryId: targetCategoryId } : t)));
  notifyTagsChanged();
}

export function notifyCategoriesChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC_CATEGORIES_CHANGED_EVENT));
}

export function notifyTagsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC_TAGS_CHANGED_EVENT));
}

/* --- Коллекции --- */

export async function getAllCollections(): Promise<CollectionRecord[]> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    return metadataBlob.collections
      .map(normalizeCollectionRecord)
      .filter((c): c is CollectionRecord => c !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const ls = safeReadArray<unknown>(STORAGE_KEYS.collections);
  return ls
    .map(normalizeCollectionRecord)
    .filter((c): c is CollectionRecord => c !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCollectionById(id: string): Promise<CollectionRecord | null> {
  const all = await getAllCollections();
  return all.find((c) => c.id === id) ?? null;
}

export async function addCollection(name: string): Promise<CollectionRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название коллекции не может быть пустым');
  }
  const b = await resolveBackend();
  const existing = await getAllCollections();
  if (existing.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Коллекция с таким названием уже есть');
  }
  const created: CollectionRecord = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString()
  };

  if (b === 'file' && metadataBlob) {
    metadataBlob.collections = [...metadataBlob.collections, created];
    await persistBlob();
  } else {
    safeWriteArray(STORAGE_KEYS.collections, [...existing, created]);
  }
  notifyCollectionsChanged();
  return created;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const existingCols = await getAllCollections();
  const removed = existingCols.find((c) => c.id === collectionId);
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.collections = metadataBlob.collections.filter((c) => {
      const n = normalizeCollectionRecord(c);
      return n?.id !== collectionId;
    });
    metadataBlob.cards = metadataBlob.cards.map((c) => ({
      ...c,
      collectionIds: c.collectionIds.filter((id) => id !== collectionId)
    }));
    await persistBlob();
  } else {
    const cols = (await getAllCollections()).filter((c) => c.id !== collectionId);
    safeWriteArray(STORAGE_KEYS.collections, cols);
    const localCards = safeReadArray<unknown>(STORAGE_KEYS.cards)
      .map(normalizeCardRecord)
      .filter((c): c is CardRecord => c !== null);
    if (localCards.length > 0) {
      const next = localCards.map((c) =>
        c.collectionIds.some((id) => id === collectionId)
          ? { ...c, collectionIds: c.collectionIds.filter((id) => id !== collectionId) }
          : c
      );
      safeWriteArray(STORAGE_KEYS.cards, next);
    }
  }
  notifyCollectionsChanged();
  notifyCardsChanged();
  if (removed?.name) {
    void tryAppendLibraryHistory(`Удалена коллекция «${removed.name}»`);
  }
}

export async function renameCollection(collectionId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Название не может быть пустым');
  const b = await resolveBackend();
  const all = await getAllCollections();
  if (all.some((c) => c.id !== collectionId && c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Коллекция с таким названием уже есть');
  }

  if (b === 'file' && metadataBlob) {
    metadataBlob.collections = metadataBlob.collections.map((item) => {
      const c = normalizeCollectionRecord(item);
      if (!c || c.id !== collectionId) return item;
      return { ...c, name: trimmed };
    });
    await persistBlob();
  } else {
    safeWriteArray(
      STORAGE_KEYS.collections,
      all.map((c) => (c.id === collectionId ? { ...c, name: trimmed } : c))
    );
  }
  notifyCollectionsChanged();
}

/* --- Карточки --- */

async function persistCards(list: CardRecord[]): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.cards = list;
    recomputeTagUsageCounts();
    await persistBlob();
    notifyCardsChanged();
    return;
  }
  safeWriteArray(
    STORAGE_KEYS.cards,
    list.map((c) => ({ id: c.id, type: c.type }))
  );
  notifyCardsChanged();
}

async function readMoodboardIdsUnified(): Promise<string[]> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    normalizeMetadataShape(metadataBlob);
    return [...metadataBlob.moodboardCardIds];
  }
  return safeReadArray<{ id?: string }>(STORAGE_KEYS.moodboard)
    .map((x) => x.id)
    .filter((id): id is string => typeof id === 'string');
}

async function persistMoodboardIds(ids: string[]): Promise<void> {
  const normalized = [...new Set(ids)];
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.moodboardCardIds = normalized;
    await persistBlob();
    notifyCardsChanged();
    return;
  }
  safeWriteArray(
    STORAGE_KEYS.moodboard,
    normalized.map((id) => ({ id }))
  );
  notifyCardsChanged();
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

async function persistMoodboardBoardInternal(board: MoodboardBoardV1): Promise<void> {
  const normalized = normalizeMoodboardBoard(board);
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.moodboardBoard = normalized;
    await persistBlob();
    notifyMoodboardBoardChanged();
    return;
  }
  writeMoodboardBoardToLocalStorage(normalized);
  notifyMoodboardBoardChanged();
}

export async function getMoodboardBoard(): Promise<MoodboardBoardV1> {
  await resolveBackend();
  if (metadataBlob?.moodboardBoard) {
    return normalizeMoodboardBoard(metadataBlob.moodboardBoard);
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
  filter: 'all' | 'images' | 'videos';
  selectedTagIds?: string[];
  cardIdExact?: string | null;
}): Promise<CardRecord[]> {
  const mbIds = await readMoodboardIdsUnified();
  const mbSet = new Set(mbIds);
  const sorted = await listCardsSorted(params.filter);
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

export async function listCardsSorted(filter: 'all' | 'images' | 'videos'): Promise<CardRecord[]> {
  const b = await resolveBackend();
  let cards: CardRecord[] = [];
  if (b === 'file' && metadataBlob) {
    cards = metadataBlob.cards.map(normalizeCardRecord).filter((c): c is CardRecord => c !== null);
  } else {
    cards = safeReadArray<unknown>(STORAGE_KEYS.cards)
      .map(normalizeCardRecord)
      .filter((c): c is CardRecord => c !== null);
  }
  const filtered = cards.filter((c) => {
    if (filter === 'images') return c.type === 'image';
    if (filter === 'videos') return c.type === 'video';
    return true;
  });
  return filtered.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

function cardHasAllTagIds(c: CardRecord, selectedTagIds: string[]): boolean {
  if (selectedTagIds.length === 0) return true;
  for (const id of selectedTagIds) {
    if (!c.tagIds.includes(id)) return false;
  }
  return true;
}

export async function listCardsPage(params: {
  offset: number;
  limit: number;
  filter: 'all' | 'images' | 'videos';
  selectedTagIds?: string[];
  cardIdExact?: string | null;
}): Promise<CardRecord[]> {
  const sorted = await listCardsSorted(params.filter);
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
    filter: 'all' | 'images' | 'videos';
    selectedTagIds?: string[];
    cardIdExact?: string | null;
  }
): Promise<CardRecord[]> {
  const sorted = (await listCardsSorted(params.filter)).filter((c) => c.collectionIds.includes(collectionId));
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
  const all = await listCardsSorted('all');
  return all.find((c) => c.id === id) ?? null;
}

/** Число карточек в каждой коллекции (по всей библиотеке). */
export async function getCollectionCardCounts(): Promise<Record<string, number>> {
  const all = await listCardsSorted('all');
  const m: Record<string, number> = {};
  for (const c of all) {
    for (const colId of c.collectionIds) {
      m[colId] = (m[colId] ?? 0) + 1;
    }
  }
  return m;
}

/** До `limitPerCollection` карточек на коллекцию для превью на разводящей (порядок как в галерее). */
export async function getCollectionPreviewSlices(limitPerCollection = 3): Promise<Record<string, CardRecord[]>> {
  const all = await listCardsSorted('all');
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
  if (b === 'file' && metadataBlob) {
    const existing = metadataBlob.cards.map(normalizeCardRecord).filter((c): c is CardRecord => c !== null);
    metadataBlob.cards = [...existing, ...newCards];
    recomputeTagUsageCounts();
    await persistBlob();
    notifyCardsChanged();
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
  patch: { tagIds?: string[]; collectionIds?: string[]; description?: string }
): Promise<void> {
  const b = await resolveBackend();
  if (b === 'file' && metadataBlob) {
    metadataBlob.cards = metadataBlob.cards.map((raw) => {
      const c = normalizeCardRecord(raw);
      if (!c || c.id !== cardId) return raw as CardRecord;
      const next: CardRecord = {
        ...c,
        ...(patch.tagIds ? { tagIds: [...patch.tagIds] } : {}),
        ...(patch.collectionIds ? { collectionIds: [...patch.collectionIds] } : {}),
        ...(patch.description !== undefined
          ? patch.description.trim()
            ? { description: patch.description.trim() }
            : { description: undefined }
          : {})
      };
      if (patch.description !== undefined && !patch.description.trim()) {
        delete next.description;
      }
      return next;
    });
    recomputeTagUsageCounts();
    await persistBlob();
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
      return updated;
    });
    safeWriteArray(STORAGE_KEYS.cards, next);
  }
  notifyCardsChanged();
  notifyTagsChanged();
}

export async function deleteCard(cardId: string): Promise<void> {
  const b = await resolveBackend();
  let relPath: string | null = null;
  let thumbPath: string | null = null;

  if (b === 'file' && metadataBlob) {
    const card = metadataBlob.cards.map(normalizeCardRecord).find((c) => c?.id === cardId) ?? null;
    relPath = card?.originalRelativePath ?? null;
    thumbPath = card?.thumbRelativePath ?? null;
    metadataBlob.cards = metadataBlob.cards.filter((raw) => {
      const c = normalizeCardRecord(raw);
      return c?.id !== cardId;
    });
    metadataBlob.moodboardCardIds = metadataBlob.moodboardCardIds.filter((id) => id !== cardId);
    if (metadataBlob.moodboardBoard) {
      metadataBlob.moodboardBoard = pruneMoodboardBoardForCard(metadataBlob.moodboardBoard, cardId);
    }
    recomputeTagUsageCounts();
    await persistBlob();
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

  if (hasArcApi()) {
    if (relPath) {
      await window.arc!.deleteFileIfInsideLibrary(relPath);
    }
    if (thumbPath && thumbPath !== relPath) {
      await window.arc!.deleteFileIfInsideLibrary(thumbPath);
    }
  }
  void tryAppendLibraryHistory('Удалена карточка');
  notifyCardsChanged();
  notifyTagsChanged();
}
