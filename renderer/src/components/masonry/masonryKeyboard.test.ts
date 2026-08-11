import { describe, expect, it } from 'vitest';
import { findArrowTargetId } from './masonryKeyboard';
import type { MasonryItemLayout } from './masonryTypes';

function layout(id: string, x: number, y: number, w = 100, h = 100): MasonryItemLayout {
  return { id, x, y, width: w, height: h, column: Math.round(x / w) };
}

function toMap(items: MasonryItemLayout[]): Map<string, MasonryItemLayout> {
  return new Map(items.map((item) => [item.id, item]));
}

describe('findArrowTargetId', () => {
  const grid = toMap([
    layout('a', 0, 0),
    layout('b', 120, 0),
    layout('c', 240, 0),
    layout('d', 0, 120),
    layout('e', 120, 120),
    layout('f', 240, 120)
  ]);
  const gridIds = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('moves across a uniform grid in all four directions', () => {
    expect(findArrowTargetId('a', 'ArrowRight', grid, gridIds)).toBe('b');
    expect(findArrowTargetId('b', 'ArrowLeft', grid, gridIds)).toBe('a');
    expect(findArrowTargetId('b', 'ArrowDown', grid, gridIds)).toBe('e');
    expect(findArrowTargetId('e', 'ArrowUp', grid, gridIds)).toBe('b');
  });

  it('returns null at the edge of the grid', () => {
    expect(findArrowTargetId('c', 'ArrowRight', grid, gridIds)).toBeNull();
    expect(findArrowTargetId('a', 'ArrowUp', grid, gridIds)).toBeNull();
  });

  it('walks a single-column list and ignores horizontal arrows', () => {
    const rows = toMap([layout('r1', 0, 0, 600, 82), layout('r2', 0, 90, 600, 82), layout('r3', 0, 180, 600, 82)]);
    const rowIds = ['r1', 'r2', 'r3'];
    expect(findArrowTargetId('r1', 'ArrowDown', rows, rowIds)).toBe('r2');
    expect(findArrowTargetId('r3', 'ArrowUp', rows, rowIds)).toBe('r2');
    expect(findArrowTargetId('r2', 'ArrowRight', rows, rowIds)).toBeNull();
    expect(findArrowTargetId('r2', 'ArrowLeft', rows, rowIds)).toBeNull();
  });

  it('skips ids that are not mounted', () => {
    expect(findArrowTargetId('a', 'ArrowRight', grid, ['a', 'c'])).toBe('c');
  });
});
