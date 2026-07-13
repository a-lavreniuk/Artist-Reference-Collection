import { normalizeHex } from '../../utils/colorPicker';
import type { CardRecord, CollectionRecord } from '../arcSchema';
import type { CategoryRecord, CategoryWeight, TagRecord } from './types';

export function safeReadArray<T>(key: string): T[] {
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

export function safeWriteArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseWeight(v: unknown): CategoryWeight {
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'neutral') {
    return v;
  }
  return 'neutral';
}

export function normalizeNameForCompare(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCategoryRecord(item: unknown, index: number): CategoryRecord {
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
  let description: string | undefined;
  if (typeof r.description === 'string' && r.description.trim()) {
    description = r.description.trim();
  }
  return {
    id,
    name,
    colorHex,
    weight,
    sortIndex,
    createdAt,
    ...(description ? { description } : {})
  };
}

export function normalizeTagRecord(item: unknown): TagRecord | null {
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

export function normalizeCardRecord(item: unknown): CardRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const type = r.type === 'video' ? 'video' : 'image';
  const addedAt = typeof r.addedAt === 'string' ? r.addedAt : new Date().toISOString();
  const originalRelativePath = typeof r.originalRelativePath === 'string' ? r.originalRelativePath : '';
  const thumbRelativePath =
    typeof r.thumbRelativePath === 'string' ? r.thumbRelativePath : originalRelativePath;
  const thumbSRelativePath =
    typeof r.thumbSRelativePath === 'string' ? r.thumbSRelativePath : thumbRelativePath;
  const thumbMRelativePath = typeof r.thumbMRelativePath === 'string' ? r.thumbMRelativePath : undefined;
  const thumbLRelativePath = typeof r.thumbLRelativePath === 'string' ? r.thumbLRelativePath : undefined;
  const dominantColorHex =
    typeof r.dominantColorHex === 'string' && r.dominantColorHex.trim()
      ? r.dominantColorHex.trim()
      : undefined;
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
  const fileCreatedAt =
    typeof r.fileCreatedAt === 'string' && r.fileCreatedAt.trim() ? r.fileCreatedAt : undefined;
  const width = typeof r.width === 'number' && Number.isFinite(r.width) ? r.width : undefined;
  const height = typeof r.height === 'number' && Number.isFinite(r.height) ? r.height : undefined;
  const videoWidth =
    typeof r.videoWidth === 'number' && Number.isFinite(r.videoWidth) ? r.videoWidth : undefined;
  const videoHeight =
    typeof r.videoHeight === 'number' && Number.isFinite(r.videoHeight) ? r.videoHeight : undefined;
  const durationMs =
    typeof r.durationMs === 'number' && Number.isFinite(r.durationMs) ? r.durationMs : undefined;
  const previewFrameMs =
    typeof r.previewFrameMs === 'number' && Number.isFinite(r.previewFrameMs) ? r.previewFrameMs : undefined;
  const description =
    typeof r.description === 'string' && r.description.trim() ? String(r.description).trim() : undefined;
  const name = typeof r.name === 'string' && r.name.trim() ? String(r.name).trim() : undefined;
  const linkUrl = typeof r.linkUrl === 'string' && r.linkUrl.trim() ? String(r.linkUrl).trim() : undefined;
  return {
    id,
    type,
    addedAt,
    originalRelativePath,
    thumbRelativePath,
    thumbSRelativePath,
    ...(thumbMRelativePath ? { thumbMRelativePath } : {}),
    ...(thumbLRelativePath ? { thumbLRelativePath } : {}),
    ...(dominantColorHex ? { dominantColorHex } : {}),
    tagIds,
    collectionIds,
    ...(format ? { format } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(fileCreatedAt ? { fileCreatedAt } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(videoWidth !== undefined ? { videoWidth } : {}),
    ...(videoHeight !== undefined ? { videoHeight } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(previewFrameMs !== undefined ? { previewFrameMs } : {}),
    ...(description ? { description } : {}),
    ...(name ? { name } : {}),
    ...(linkUrl ? { linkUrl } : {}),
    ...(fileSize !== undefined ? { fileSize } : {}),
    ...(fileSizeMb !== undefined ? { fileSizeMb } : {})
  };
}

export function normalizeCollectionRecord(item: unknown, index = 0): CollectionRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString();
  const sortIndex = typeof r.sortIndex === 'number' ? r.sortIndex : index;
  const description = typeof r.description === 'string' ? r.description.trim() : undefined;
  if (!id) return null;
  return {
    id,
    name: name || 'Без названия',
    createdAt,
    sortIndex,
    ...(description ? { description } : {})
  };
}

export function mapStorageTag(raw: {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  tooltipImage?: string;
}): TagRecord {
  return {
    id: raw.id,
    categoryId: raw.categoryId,
    name: raw.name,
    usageCount: raw.usageCount,
    ...(raw.description ? { description: raw.description } : {}),
    ...(raw.tooltipImage ? { tooltipImageDataUrl: raw.tooltipImage } : {})
  };
}

export function mapStorageTagToDb(tag: TagRecord): {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  tooltipImage?: string;
} {
  return {
    id: tag.id,
    categoryId: tag.categoryId,
    name: tag.name,
    usageCount: tag.usageCount,
    ...(tag.description ? { description: tag.description } : {}),
    ...(tag.tooltipImageDataUrl ? { tooltipImage: tag.tooltipImageDataUrl } : {})
  };
}

export function sortCollections(list: CollectionRecord[]): CollectionRecord[] {
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru'));
}

export function cardHasAllTagIds(c: CardRecord, selectedTagIds: string[]): boolean {
  if (selectedTagIds.length === 0) return true;
  for (const id of selectedTagIds) {
    if (!c.tagIds.includes(id)) return false;
  }
  return true;
}
