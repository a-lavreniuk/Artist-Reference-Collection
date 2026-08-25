import { describe, expect, it, vi } from 'vitest';
import { buildCollectionContextMenuRows } from './buildCollectionContextMenuRows';

describe('buildCollectionContextMenuRows', () => {
  it('adds explorer actions for a section', () => {
    const rows = buildCollectionContextMenuRows({
      variant: 'section',
      onOpen: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onMove: vi.fn(),
      onMerge: vi.fn(),
      canMove: true,
      canMerge: true
    });
    const keys = rows.filter((row) => row.type === 'item').map((row) => row.key);
    expect(keys).toEqual(['open', 'rename', 'duplicate', 'move', 'merge', 'delete']);
  });

  it('adds a new-section action for a collection', () => {
    const rows = buildCollectionContextMenuRows({
      variant: 'collection',
      onOpen: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onAddSection: vi.fn()
    });
    const keys = rows.filter((row) => row.type === 'item').map((row) => row.key);
    expect(keys).toEqual(['open', 'rename', 'add-section', 'delete']);
  });
});
