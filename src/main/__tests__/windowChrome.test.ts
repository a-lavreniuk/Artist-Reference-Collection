import { describe, expect, it } from 'vitest';

import {
  boundsMatchWorkArea,
  shouldApplyDarwinLayoutNudge,
  shouldMaximizeOnShow,
  windowedBoundsInWorkArea
} from '../windowChrome';
import { clampWindowSize, WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from '../windowSize';

describe('shouldMaximizeOnShow', () => {
  it('maximizes in normal resizable mode', () => {
    expect(shouldMaximizeOnShow(true)).toBe(true);
  });

  it('does not maximize during onboarding (non-resizable)', () => {
    expect(shouldMaximizeOnShow(false)).toBe(false);
  });
});

describe('shouldApplyDarwinLayoutNudge', () => {
  it('skips nudge while maximized so frameless bounds stay on work area', () => {
    expect(shouldApplyDarwinLayoutNudge(true)).toBe(false);
  });

  it('allows nudge when windowed (layout sync after hide/show)', () => {
    expect(shouldApplyDarwinLayoutNudge(false)).toBe(true);
  });
});

describe('boundsMatchWorkArea', () => {
  const workArea = { x: 0, y: 25, width: 1440, height: 875 };

  it('matches exact work area', () => {
    expect(boundsMatchWorkArea(workArea, workArea)).toBe(true);
  });

  it('matches within tolerance', () => {
    expect(
      boundsMatchWorkArea({ x: 1, y: 26, width: 1439, height: 874 }, workArea, 2)
    ).toBe(true);
  });

  it('rejects corner-sized window that is not work area', () => {
    expect(
      boundsMatchWorkArea({ x: 0, y: 25, width: WINDOW_MIN_WIDTH, height: WINDOW_MIN_HEIGHT }, workArea)
    ).toBe(false);
  });
});

describe('windowedBoundsInWorkArea', () => {
  it('returns bounds smaller than work area so restore is not stuck maximized', () => {
    const workArea = { x: 0, y: 25, width: 1440, height: 875 };
    const restored = windowedBoundsInWorkArea(workArea);
    expect(boundsMatchWorkArea(restored, workArea)).toBe(false);
    expect(restored.width).toBeLessThan(workArea.width);
    expect(restored.height).toBeLessThan(workArea.height);
  });

  it('keeps window within work area on small displays', () => {
    const workArea = { x: 10, y: 20, width: 1280, height: 800 };
    const restored = windowedBoundsInWorkArea(workArea);
    expect(restored.x).toBeGreaterThanOrEqual(workArea.x);
    expect(restored.y).toBeGreaterThanOrEqual(workArea.y);
    expect(restored.x + restored.width).toBeLessThanOrEqual(workArea.x + workArea.width);
    expect(restored.y + restored.height).toBeLessThanOrEqual(workArea.y + workArea.height);
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
