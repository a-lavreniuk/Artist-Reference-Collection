import { describe, expect, it } from 'vitest';
import {
  addIdsToSet,
  computeMarqueeSelection,
  idsIntersectingRect,
  normalizeSelectionRect,
  rangeSelectIds,
  removeIdsFromSet,
  resolveMarqueeMode,
  setsEqual,
  toggleIdInSet
} from './galleryCardSelectionCore';

describe('galleryCardSelectionCore', () => {
  it('toggleIdInSet adds and removes ids', () => {
    expect([...toggleIdInSet(new Set(), 'a')]).toEqual(['a']);
    expect([...toggleIdInSet(new Set(['a']), 'a')]).toEqual([]);
    expect([...toggleIdInSet(new Set(['a']), 'b')].sort()).toEqual(['a', 'b']);
  });

  it('rangeSelectIds selects inclusive feed range', () => {
    const ordered = ['a', 'b', 'c', 'd'];
    expect([...rangeSelectIds(ordered, 'b', 'd', new Set())].sort()).toEqual(['b', 'c', 'd']);
    expect([...rangeSelectIds(ordered, 'd', 'b', new Set(['x']))].sort()).toEqual(['b', 'c', 'd', 'x']);
    expect([...rangeSelectIds(ordered, null, 'c', new Set(['x']))].sort()).toEqual(['c', 'x']);
    expect([...rangeSelectIds(ordered, 'a', 'c', new Set())].sort()).toEqual(['a', 'b', 'c']);
  });

  it('addIdsToSet merges without duplicates', () => {
    expect([...addIdsToSet(new Set(['a']), ['b', 'a'])].sort()).toEqual(['a', 'b']);
  });

  it('removeIdsFromSet subtracts marquee hits and ignores unknown ids', () => {
    expect([...removeIdsFromSet(new Set(['a', 'b', 'c']), ['b', 'x'])].sort()).toEqual(['a', 'c']);
    expect([...removeIdsFromSet(new Set(['a']), ['a'])]).toEqual([]);
  });

  it('idsIntersectingRect returns overlapping card ids', () => {
    const rects = new Map<string, DOMRect>([
      ['a', { left: 0, top: 0, right: 10, bottom: 10 } as DOMRect],
      ['b', { left: 20, top: 20, right: 30, bottom: 30 } as DOMRect]
    ]);
    const hits = idsIntersectingRect(
      rects,
      normalizeSelectionRect(5, 5, 25, 25)
    );
    expect(hits.sort()).toEqual(['a', 'b']);
  });

  it('resolveMarqueeMode maps modifiers to marquee behaviour', () => {
    expect(resolveMarqueeMode({ ctrlKey: false, metaKey: false, altKey: false })).toBe('replace');
    expect(resolveMarqueeMode({ ctrlKey: true, metaKey: false, altKey: false })).toBe('add');
    expect(resolveMarqueeMode({ ctrlKey: false, metaKey: true, altKey: false })).toBe('add');
    expect(resolveMarqueeMode({ ctrlKey: false, metaKey: false, altKey: true })).toBe('subtract');
    expect(resolveMarqueeMode({ ctrlKey: true, metaKey: false, altKey: true })).toBe('subtract');
  });

  it('computeMarqueeSelection replaces, adds and subtracts', () => {
    const base = new Set(['a', 'b']);
    const inside = new Set(['b', 'c']);
    expect([...computeMarqueeSelection(base, inside, 'replace')].sort()).toEqual(['b', 'c']);
    expect([...computeMarqueeSelection(base, inside, 'add')].sort()).toEqual(['a', 'b', 'c']);
    expect([...computeMarqueeSelection(base, inside, 'subtract')].sort()).toEqual(['a']);
    expect([...computeMarqueeSelection(base, new Set(), 'replace')]).toEqual([]);
  });

  it('setsEqual compares membership', () => {
    expect(setsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(setsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false);
    expect(setsEqual(new Set(['a']), new Set(['b']))).toBe(false);
  });

  it('normalizeSelectionRect orders coordinates', () => {
    expect(normalizeSelectionRect(10, 20, 0, 0)).toEqual({
      left: 0,
      top: 0,
      right: 10,
      bottom: 20
    });
  });
});
