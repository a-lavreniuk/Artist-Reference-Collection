import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryRow, TagRow } from '../../storage/types';

const listCategories = vi.fn<() => CategoryRow[]>(() => []);
const listAllTags = vi.fn<() => TagRow[]>(() => []);
const upsertCategory = vi.fn();
const upsertTag = vi.fn();
const notifyRendererTagCatalogChanged = vi.fn();

vi.mock('../../storage/libraryStorage', () => ({
  listCategories: () => listCategories(),
  listAllTags: () => listAllTags(),
  upsertCategory: (root: string, cat: CategoryRow) => upsertCategory(root, cat),
  upsertTag: (root: string, tag: TagRow) => upsertTag(root, tag)
}));

vi.mock('../notifyRenderer', () => ({
  notifyRendererTagCatalogChanged: () => notifyRendererTagCatalogChanged()
}));

import { createCategory, createTag } from '../tagCatalogService';

const ROOT = '/library';

describe('tagCatalogService', () => {
  beforeEach(() => {
    listCategories.mockReset();
    listAllTags.mockReset();
    upsertCategory.mockReset();
    upsertTag.mockReset();
    notifyRendererTagCatalogChanged.mockReset();
    listCategories.mockReturnValue([]);
    listAllTags.mockReturnValue([]);
  });

  it('createCategory rejects empty name', () => {
    expect(() => createCategory(ROOT, { name: '  ' })).toThrow('Название категории не может быть пустым');
  });

  it('createCategory rejects duplicate name', () => {
    listCategories.mockReturnValue([
      {
        id: 'c1',
        name: 'Animals',
        colorHex: '#EAB308',
        weight: 'neutral',
        sortIndex: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]);
    expect(() => createCategory(ROOT, { name: 'animals' })).toThrow('Категория с таким названием уже есть');
  });

  it('createCategory persists and notifies', () => {
    const created = createCategory(ROOT, { name: 'Nature', colorHex: '#FF0000' });
    expect(created.name).toBe('Nature');
    expect(created.colorHex).toBe('#FF0000');
    expect(upsertCategory).toHaveBeenCalledWith(ROOT, created);
    expect(notifyRendererTagCatalogChanged).toHaveBeenCalled();
  });

  it('createTag requires existing category', () => {
    expect(() => createTag(ROOT, { categoryId: 'missing', name: 'Cat' })).toThrow('Категория не найдена');
  });

  it('createTag rejects duplicate tag name', () => {
    listCategories.mockReturnValue([
      {
        id: 'c1',
        name: 'Animals',
        colorHex: '#EAB308',
        weight: 'neutral',
        sortIndex: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]);
    listAllTags.mockReturnValue([{ id: 't1', categoryId: 'c1', name: 'Cat', usageCount: 0 }]);
    expect(() => createTag(ROOT, { categoryId: 'c1', name: 'cat' })).toThrow('Метка с таким названием уже есть');
  });

  it('createTag persists and notifies', () => {
    listCategories.mockReturnValue([
      {
        id: 'c1',
        name: 'Animals',
        colorHex: '#EAB308',
        weight: 'neutral',
        sortIndex: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]);
    const created = createTag(ROOT, { categoryId: 'c1', name: 'Dog' });
    expect(created.name).toBe('Dog');
    expect(created.usageCount).toBe(0);
    expect(upsertTag).toHaveBeenCalledWith(ROOT, created);
    expect(notifyRendererTagCatalogChanged).toHaveBeenCalled();
  });
});
