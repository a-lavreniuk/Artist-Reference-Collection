import { describe, expect, it } from 'vitest';
import {
  collectDetailPrefetchCardIds,
  resolveCardFeedNeighbors,
  shouldShowDetailNavButtons
} from './cardFeedNeighbors';

describe('resolveCardFeedNeighbors', () => {
  it('returns adjacent ids in feed order', () => {
    const feed = ['a', 'b', 'c'];
    expect(resolveCardFeedNeighbors('b', feed)).toEqual({ prev: 'a', next: 'c' });
    expect(resolveCardFeedNeighbors('a', feed)).toEqual({ prev: null, next: 'b' });
    expect(resolveCardFeedNeighbors('c', feed)).toEqual({ prev: 'b', next: null });
  });

  it('returns null neighbors for unknown card', () => {
    expect(resolveCardFeedNeighbors('x', ['a'])).toEqual({ prev: null, next: null });
  });

  it('hides nav buttons when the group has a single card', () => {
    expect(shouldShowDetailNavButtons({ prev: null, next: null })).toBe(false);
    expect(shouldShowDetailNavButtons(undefined)).toBe(false);
  });

  it('shows nav buttons when at least one neighbor exists', () => {
    expect(shouldShowDetailNavButtons({ prev: null, next: 'b' })).toBe(true);
    expect(shouldShowDetailNavButtons({ prev: 'a', next: null })).toBe(true);
    expect(shouldShowDetailNavButtons({ prev: 'a', next: 'c' })).toBe(true);
  });
});

describe('collectDetailPrefetchCardIds', () => {
  it('includes prev/next and ±2 from the queue without the current card', () => {
    const queue = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(collectDetailPrefetchCardIds('c', { prev: 'b', next: 'd' }, queue)).toEqual([
      'b',
      'd',
      'a',
      'e'
    ]);
  });

  it('dedupes neighbor ids that already appear in the queue window', () => {
    expect(collectDetailPrefetchCardIds('b', { prev: 'a', next: 'c' }, ['a', 'b', 'c'])).toEqual([
      'a',
      'c'
    ]);
  });
});
