import { describe, expect, it } from 'vitest';

import { shouldMaximizeOnShow } from '../windowChrome';
import { clampWindowSize, WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from '../windowSize';

describe('shouldMaximizeOnShow', () => {
  it('maximizes in normal resizable mode', () => {
    expect(shouldMaximizeOnShow(true)).toBe(true);
  });

  it('does not maximize during onboarding (non-resizable)', () => {
    expect(shouldMaximizeOnShow(false)).toBe(false);
  });
});

describe('clampWindowSize', () => {
  it('enforces default minimum when no work area', () => {
    expect(clampWindowSize(800, 600)).toEqual({
      width: WINDOW_MIN_WIDTH,
      height: WINDOW_MIN_HEIGHT
    });
  });

  it('fits work area smaller than WINDOW_MIN_WIDTH', () => {
    expect(clampWindowSize(1920, 1080, { width: 1280, height: 800 })).toEqual({
      width: 1280,
      height: 800
    });
  });

  it('clamps oversized request to work area', () => {
    expect(clampWindowSize(3000, 2000, { width: 1920, height: 1080 })).toEqual({
      width: 1920,
      height: 1080
    });
  });

  it('preserves valid size within work area', () => {
    expect(clampWindowSize(1600, 1000, { width: 1920, height: 1080 })).toEqual({
      width: 1600,
      height: 1000
    });
  });
});
