import { describe, expect, it } from 'vitest';
import {
  addCollectionToCardIds,
  assertCollectionParentIsRoot,
  filterCollectionPickerTree,
  flattenCollectionTree,
  formatSectionCountLabel,
  normalizeCardCollectionIds,
  parseCollectionsPath,
  removeCollectionFromCardIds,
  siblingNameTaken,
  toggleCollectionOnCardIds,
  uniqueCopyName,
  uniqueSiblingName
} from '../collectionHierarchy';

const collections = [
  { id: 'c1', name: 'Персонажи', parentId: null, sortIndex: 0 },
  { id: 's1', name: 'Портреты', parentId: 'c1', sortIndex: 0 },
  { id: 's2', name: 'Фуллы', parentId: 'c1', sortIndex: 1 },
  { id: 'c2', name: 'Локации', parentId: null, sortIndex: 1 }
];

describe('collectionHierarchy', () => {
  it('rejects nesting a section under a section', () => {
    expect(() => assertCollectionParentIsRoot(collections, 's1')).toThrow(/Раздел нельзя вложить/);
  });

  it('checks sibling names only within the same parent', () => {
    expect(siblingNameTaken(collections, 'Портреты', 'c1')).toBe(true);
    expect(siblingNameTaken(collections, 'Портреты', 'c2')).toBe(false);
    expect(siblingNameTaken(collections, 'Персонажи', null)).toBe(true);
    expect(siblingNameTaken(collections, 'Персонажи', 'c1')).toBe(false);
  });

  it('adds parent when assigning a section', () => {
    expect(addCollectionToCardIds([], 's1', collections).sort()).toEqual(['c1', 's1']);
  });

  it('keeps the collection when removing a section', () => {
    expect(removeCollectionFromCardIds(['c1', 's1', 's2'], 's1', collections).sort()).toEqual(['c1', 's2']);
  });

  it('removes all sections when removing the collection', () => {
    expect(removeCollectionFromCardIds(['c1', 's1', 's2', 'c2'], 'c1', collections)).toEqual(['c2']);
  });

  it('normalizes legacy section-only membership', () => {
    expect(normalizeCardCollectionIds(['s1'], collections).sort()).toEqual(['c1', 's1']);
  });

  it('toggles section membership without dropping the parent', () => {
    const added = toggleCollectionOnCardIds(['c1'], 's1', collections);
    expect(added.sort()).toEqual(['c1', 's1']);
    expect(toggleCollectionOnCardIds(added, 's1', collections)).toEqual(['c1']);
  });

  it('flattens roots then their sections', () => {
    expect(flattenCollectionTree(collections).map((item) => item.id)).toEqual(['c1', 's1', 's2', 'c2']);
  });

  it('builds copy names among siblings', () => {
    expect(uniqueCopyName(collections, 'Портреты', 'c1')).toBe('Копия Портреты');
    const withCopy = [...collections, { id: 's3', name: 'Копия Портреты', parentId: 'c1' }];
    expect(uniqueCopyName(withCopy, 'Портреты', 'c1')).toBe('Копия Портреты 2');
  });

  it('suffixes colliding sibling names', () => {
    expect(uniqueSiblingName(collections, 'Персонажи', null)).toBe('Персонажи 2');
  });

  it('parses collection and section paths', () => {
    expect(parseCollectionsPath('/collections/abc-123')).toEqual({ collectionId: 'abc-123' });
    expect(parseCollectionsPath('/collections/abc/sections/sec-1')).toEqual({
      collectionId: 'abc',
      sectionId: 'sec-1'
    });
    expect(parseCollectionsPath('/gallery')).toBeNull();
  });

  it('keeps the parent when search matches only a section', () => {
    const rows = filterCollectionPickerTree(collections, 'Портреты');
    expect(rows.map((row) => row.item.id)).toEqual(['c1', 's1']);
    expect(rows[1]?.nested).toBe(true);
  });

  it('shows all sections when the collection name matches', () => {
    const rows = filterCollectionPickerTree(collections, 'Персонажи');
    expect(rows.map((row) => row.item.id)).toEqual(['c1', 's1', 's2']);
  });

  it('pluralizes section counts', () => {
    expect(formatSectionCountLabel(1)).toBe('1 раздел');
    expect(formatSectionCountLabel(2)).toBe('2 раздела');
    expect(formatSectionCountLabel(5)).toBe('5 разделов');
    expect(formatSectionCountLabel(21)).toBe('21 раздел');
  });
});
