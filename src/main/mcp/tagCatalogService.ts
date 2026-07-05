import { randomUUID } from 'crypto';

import {
  listAllTags,
  listCategories,
  upsertCategory,
  upsertTag
} from '../storage/libraryStorage';
import type { CategoryRow, TagRow } from '../storage/types';
import { notifyRendererTagCatalogChanged } from './notifyRenderer';

export type CategoryWeight = CategoryRow['weight'];

function normalizeNameForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return null;
}

function sanitizeWeight(raw: unknown): CategoryWeight {
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  return 'neutral';
}

export type CreateCategoryInput = {
  name: string;
  colorHex?: string;
  weight?: CategoryWeight;
  description?: string;
};

export type UpdateCategoryInput = {
  categoryId: string;
  name?: string;
  colorHex?: string;
  weight?: CategoryWeight;
  description?: string;
};

export type CreateTagInput = {
  categoryId: string;
  name: string;
  description?: string;
};

export type UpdateTagInput = {
  tagId: string;
  name?: string;
  categoryId?: string;
  description?: string;
};

export function createCategory(libraryRoot: string, input: CreateCategoryInput): CategoryRow {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error('Название категории не может быть пустым');
  }
  const hex = normalizeHex(input.colorHex ?? '#EAB308') ?? '#EAB308';
  const weight = sanitizeWeight(input.weight);
  const desc = input.description?.trim();
  const list = listCategories(libraryRoot);
  if (list.some((c) => normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Категория с таким названием уже есть');
  }
  const maxSort = list.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const created: CategoryRow = {
    id: randomUUID(),
    name: trimmed,
    colorHex: hex,
    weight,
    sortIndex: maxSort + 1,
    createdAt: new Date().toISOString(),
    ...(desc ? { description: desc } : {})
  };
  upsertCategory(libraryRoot, created);
  notifyRendererTagCatalogChanged();
  return created;
}

export function updateCategoryRecord(libraryRoot: string, input: UpdateCategoryInput): CategoryRow {
  const list = listCategories(libraryRoot);
  const current = list.find((c) => c.id === input.categoryId);
  if (!current) {
    throw new Error('Категория не найдена');
  }

  let name = current.name;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Название не может быть пустым');
    }
    if (list.some((c) => c.id !== current.id && normalizeNameForCompare(c.name) === normalizeNameForCompare(trimmed))) {
      throw new Error('Категория с таким названием уже есть');
    }
    name = trimmed;
  }

  let colorHex = current.colorHex;
  if (input.colorHex !== undefined) {
    const hex = normalizeHex(input.colorHex);
    if (!hex) {
      throw new Error('Некорректный цвет');
    }
    colorHex = hex;
  }

  const weight = input.weight !== undefined ? sanitizeWeight(input.weight) : current.weight;

  let description = current.description;
  if (input.description !== undefined) {
    const desc = input.description.trim();
    description = desc || undefined;
  }

  const updated: CategoryRow = {
    ...current,
    name,
    colorHex,
    weight,
    ...(description ? { description } : {})
  };
  if (!description) {
    delete updated.description;
  }
  upsertCategory(libraryRoot, updated);
  notifyRendererTagCatalogChanged();
  return updated;
}

export function createTag(libraryRoot: string, input: CreateTagInput): TagRow {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error('Название метки не может быть пустым');
  }
  if (!listCategories(libraryRoot).some((c) => c.id === input.categoryId)) {
    throw new Error('Категория не найдена');
  }
  const tags = listAllTags(libraryRoot);
  if (tags.some((t) => normalizeNameForCompare(t.name) === normalizeNameForCompare(trimmed))) {
    throw new Error('Метка с таким названием уже есть');
  }
  const desc = input.description?.trim();
  const created: TagRow = {
    id: randomUUID(),
    categoryId: input.categoryId,
    name: trimmed,
    usageCount: 0,
    ...(desc ? { description: desc } : {})
  };
  upsertTag(libraryRoot, created);
  notifyRendererTagCatalogChanged();
  return created;
}

export function updateTagRecord(libraryRoot: string, input: UpdateTagInput): TagRow {
  const tags = listAllTags(libraryRoot);
  const current = tags.find((t) => t.id === input.tagId);
  if (!current) {
    throw new Error('Метка не найдена');
  }

  const categoryId = input.categoryId ?? current.categoryId;
  if (!listCategories(libraryRoot).some((c) => c.id === categoryId)) {
    throw new Error('Категория не найдена');
  }

  let name = current.name;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Название метки не может быть пустым');
    }
    if (tags.some((t) => t.id !== current.id && normalizeNameForCompare(t.name) === normalizeNameForCompare(trimmed))) {
      throw new Error('Метка с таким названием уже есть');
    }
    name = trimmed;
  }

  let description = current.description;
  if (input.description !== undefined) {
    const desc = input.description.trim();
    description = desc || undefined;
  }

  const updated: TagRow = {
    ...current,
    name,
    categoryId,
    usageCount: current.usageCount,
    ...(description ? { description } : {})
  };
  if (!description) {
    delete updated.description;
  }
  upsertTag(libraryRoot, updated);
  notifyRendererTagCatalogChanged();
  return updated;
}
