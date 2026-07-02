import { describe, expect, it } from 'vitest';

import { shuffleSortKeyForId } from '../shuffleOrder';

describe('shuffleSortKeyForId', () => {
  it('is deterministic for the same id and seed', () => {
    expect(shuffleSortKeyForId('card-a', 42)).toBe(shuffleSortKeyForId('card-a', 42));
  });

  it('changes when seed changes', () => {
    expect(shuffleSortKeyForId('card-a', 1)).not.toBe(shuffleSortKeyForId('card-a', 2));
  });

  it('changes when id changes', () => {
    expect(shuffleSortKeyForId('card-a', 1)).not.toBe(shuffleSortKeyForId('card-b', 1));
  });
});
