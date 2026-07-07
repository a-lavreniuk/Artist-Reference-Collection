import { describe, expect, it } from 'vitest';

import { shouldCloseInitialRevealBatch } from './useMasonryReveal';

describe('useMasonryReveal helpers', () => {
  it('shouldCloseInitialRevealBatch waits until no pending initial ids', () => {
    expect(shouldCloseInitialRevealBatch(10, 3, false)).toBe(false);
    expect(shouldCloseInitialRevealBatch(10, 0, false)).toBe(true);
    expect(shouldCloseInitialRevealBatch(0, 0, false)).toBe(false);
    expect(shouldCloseInitialRevealBatch(10, 0, true)).toBe(false);
  });
});
