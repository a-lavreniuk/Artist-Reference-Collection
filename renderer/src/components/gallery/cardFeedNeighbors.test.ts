import { describe, expect, it } from 'vitest';
import { resolveCardFeedNeighbors } from './cardFeedNeighbors';

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
});
