import { normalizeHex } from '../../utils/colorPicker';
import * as storage from '../storageClient';
import {
  migrateCategoriesIfNeededLocal,
  persistCategories,
  persistTags,
  readCategoriesUnified,
  readTagsUnified,
  resolveBackend,
  tryAppendLibraryHistory
} from './backend';
import { historyQuotedEntity } from '../historySegments';
import { newId, normalizeNameForCompare } from './internal';
import {
  notifyCardsChanged,
  notifyCategoriesChanged,
  notifyTagsChanged
} from './events';
import type { CategoryRecord, CategoryStats, CategoryWeight, TagRecord } from './types';

export async function getAllCategories(): Promise<CategoryRecord[]> {
  const list = await readCategoriesUnified();
  const b = await resolveBackend();
  if (b === 'local') {
    migrateCategoriesIfNeededLocal(list);
  }
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru'));
}

export async function addCategory(
  name: string,
  colorHex: string,
  extras?: { weight?: CategoryWeight; description?: string }
): Promise<CategoryRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название категории не может быть пустым');
  }
  const hex = normalizeHex(colorHex) ?? '#EAB308';
  const weight = extras?.weight ?? 'neutral';
  const desc = extras?.description?.trim();
  const list = await readCategoriesUnified();
  if (list.some((c) => normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Категория с таким названием уже есть');
  }
  const maxSort = list.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const created: CategoryRecord = {
    id: newId(),
    name: trimmed,
    colorHex: hex,
    weight,
    sortIndex: maxSort + 1,
    createdAt: new Date().toISOString(),
    ...(desc ? { description: desc } : {})
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

export async function updateCategoryDescription(id: string, description: string): Promise<void> {
  const desc = description.trim();
  const list = await readCategoriesUnified();
  await persistCategories(
    list.map((c) => {
      if (c.id !== id) return c;
      if (desc) return { ...c, description: desc };
      const next = { ...c };
      delete next.description;
      return next;
    })
  );
  notifyCategoriesChanged();
}

export async function updateCategory(
  id: string,
  patch: {
    name?: string;
    colorHex?: string;
    weight?: CategoryWeight;
    description?: string;
  }
): Promise<void> {
  const list = await readCategoriesUnified();
  const current = list.find((c) => c.id === id);
  if (!current) return;

  let name = current.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) {
      throw new Error('Название не может быть пустым');
    }
    if (list.some((c) => c.id !== id && normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
      throw new Error('Категория с таким названием уже есть');
    }
    name = trimmed;
  }

  let colorHex = current.colorHex;
  if (patch.colorHex !== undefined) {
    const hex = normalizeHex(patch.colorHex);
    if (!hex) {
      throw new Error('Некорректный цвет');
    }
    colorHex = hex;
  }

  const weight = patch.weight ?? current.weight;

  await persistCategories(
    list.map((c) => {
      if (c.id !== id) return c;
      const next: CategoryRecord = { ...c, name, colorHex, weight };
      if (patch.description !== undefined) {
        const desc = patch.description.trim();
        if (desc) next.description = desc;
        else delete next.description;
      }
      return next;
    })
  );
}

export async function getCategoryStats(categoryId: string): Promise<CategoryStats> {
  const categories = await readCategoriesUnified();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return { tagCount: 0, cardsWithTags: 0, usageSum: 0, createdAt: new Date().toISOString() };
  }

  const tags = await getTagsByCategory(categoryId);
  const tagIds = new Set(tags.map((t) => t.id));
  const usageSum = tags.reduce((sum, t) => sum + t.usageCount, 0);

  let cardsWithTags = 0;
  if (tagIds.size > 0) {
    const b = await resolveBackend();
    if (b === 'file') {
      cardsWithTags = await storage.storageCountCardsWithTagIds([...tagIds]);
    } else {
      const { listCardsSorted } = await import('./cards');
      const cards = await listCardsSorted('all');
      cardsWithTags = cards.filter((c) => c.tagIds.some((tid) => tagIds.has(tid))).length;
    }
  }

  return {
    tagCount: tags.length,
    cardsWithTags,
    usageSum,
    createdAt: category.createdAt
  };
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

/** Перестановка категории на позицию insertIndex в отсортированном списке (для DnD в sidebar). */
export async function reorderCategoryToIndex(id: string, insertIndex: number): Promise<void> {
  const sorted = await getAllCategories();
  const fromIndex = sorted.findIndex((c) => c.id === id);
  if (fromIndex < 0) return;

  const clamped = Math.max(0, Math.min(insertIndex, sorted.length));
  if (clamped === fromIndex || clamped === fromIndex + 1) return;

  const next = [...sorted];
  const [item] = next.splice(fromIndex, 1);
  const targetIndex = clamped > fromIndex ? clamped - 1 : clamped;
  next.splice(targetIndex, 0, item);

  const idToSort = new Map(next.map((c, i) => [c.id, i]));
  const list = (await readCategoriesUnified()).map((c) => ({
    ...c,
    sortIndex: idToSort.get(c.id) ?? c.sortIndex
  }));
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
  notifyTagsChanged();
  notifyCardsChanged();
  const entry = historyQuotedEntity('Удалена метка «', {
    entityType: 'tag',
    id: tagId,
    label: removed.name
  });
  void tryAppendLibraryHistory(entry.message, entry.segments);
}

export async function getDuplicateSimilarityThresholdPct(): Promise<number> {
  const b = await resolveBackend();
  if (b === 'file') {
    const sys = await storage.storageGetSystem();
    return sys?.duplicateSimilarityThresholdPct ?? 85;
  }
  return 85;
}

export async function setDuplicateSimilarityThresholdPct(pct: number): Promise<void> {
  const b = await resolveBackend();
  if (b !== 'file') return;
  const sys = (await storage.storageGetSystem()) ?? {
    version: 1 as const,
    schemaVersion: 2,
    duplicateSimilarityThresholdPct: 85
  };
  await storage.storageSaveSystem({
    ...sys,
    version: 1,
    schemaVersion: sys.schemaVersion ?? 2,
    duplicateSimilarityThresholdPct: Math.min(100, Math.max(50, pct))
  });
}

export async function addSkippedDuplicatePair(idA: string, idB: string): Promise<void> {
  const b = await resolveBackend();
  if (b !== 'file') return;
  await storage.storageAddSkippedPair(idA, idB);
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
