import { describe, expect, it } from 'vitest';
import {
  mergeCategoriesById,
  mergeCollectionsById,
  tagsByCategoryMap
} from './useDuplicatePairDetails';
import type { CategoryRecord, TagRecord } from '../../services/db';
import type { CollectionRecord } from '../../services/arcSchema';

const cat = (partial: Partial<CategoryRecord> & Pick<CategoryRecord, 'id' | 'name'>): CategoryRecord => ({
  colorHex: '#000000',
  weight: 'neutral',
  sortIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...partial
});

describe('duplicate pair catalog merge', () => {
  it('keeps collections from both libraries', () => {
    const active: CollectionRecord[] = [
      { id: 'c-active', name: 'Active', createdAt: '2026-01-01T00:00:00.000Z', sortIndex: 0 }
    ];
    const other: CollectionRecord[] = [
      { id: 'c-other', name: 'Other lib', createdAt: '2026-01-01T00:00:00.000Z', sortIndex: 0 }
    ];
    const merged = mergeCollectionsById(active, other);
    expect([...merged.keys()].sort()).toEqual(['c-active', 'c-other']);
    expect(merged.get('c-other')?.name).toBe('Other lib');
  });

  it('groups all tags in one pass', () => {
    const tags: TagRecord[] = [
      { id: 't2', categoryId: 'cat', name: 'Beta', usageCount: 0 },
      { id: 't1', categoryId: 'cat', name: 'Alpha', usageCount: 1 }
    ];
    const grouped = tagsByCategoryMap(tags);
    expect(grouped.get('cat')?.map((t) => t.name)).toEqual(['Alpha', 'Beta']);
  });

  it('merges hidden categories from the pair catalog', () => {
    const visible = [cat({ id: 'a', name: 'Visible', sortIndex: 1 })];
    const fromPair = [cat({ id: 'b', name: 'Other library', sortIndex: 0 })];
    expect(mergeCategoriesById(visible, fromPair).map((c) => c.id)).toEqual(['b', 'a']);
  });
});
