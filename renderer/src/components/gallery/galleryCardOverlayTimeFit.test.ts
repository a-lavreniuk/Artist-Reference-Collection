import { describe, expect, it } from 'vitest';
import { shouldHideOverlayTime } from './galleryCardOverlayTimeFit';

describe('shouldHideOverlayTime', () => {
  const base = {
    badgeWidthPx: 40,
    timeWidthPx: 72,
    rightWidthPx: 56,
    leftGapPx: 6,
    rowGapPx: 8
  };

  it('keeps time visible when the row fits', () => {
    expect(
      shouldHideOverlayTime({
        ...base,
        availablePx: 200,
        currentlyHidden: false
      })
    ).toBe(false);
  });

  it('hides time when the row overflows', () => {
    // 40 + 6 + 72 + 8 + 56 = 182
    expect(
      shouldHideOverlayTime({
        ...base,
        availablePx: 180,
        currentlyHidden: false
      })
    ).toBe(true);
  });

  it('keeps time hidden until hysteresis clears', () => {
    // need = 182; available 185 → still hidden (182 + 8 > 185)
    expect(
      shouldHideOverlayTime({
        ...base,
        availablePx: 185,
        currentlyHidden: true
      })
    ).toBe(true);

    // available 190 → show (182 + 8 <= 190)
    expect(
      shouldHideOverlayTime({
        ...base,
        availablePx: 190,
        currentlyHidden: true
      })
    ).toBe(false);
  });
});
