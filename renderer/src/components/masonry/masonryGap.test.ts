import { describe, expect, it } from 'vitest';

import { MASONRY_GAP_PX, MASONRY_GAP_PX_S, resolveMasonryGapPx } from './masonryTypes';

describe('resolveMasonryGapPx', () => {
  it('returns compact gap for grid size S', () => {
    expect(resolveMasonryGapPx('s')).toBe(MASONRY_GAP_PX_S);
    expect(MASONRY_GAP_PX_S).toBe(16);
  });

  it('returns default gap for grid sizes M and L', () => {
    expect(resolveMasonryGapPx('m')).toBe(MASONRY_GAP_PX);
    expect(resolveMasonryGapPx('l')).toBe(MASONRY_GAP_PX);
    expect(MASONRY_GAP_PX).toBe(32);
  });
});
