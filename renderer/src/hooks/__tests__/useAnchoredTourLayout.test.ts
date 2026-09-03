import { describe, expect, it } from 'vitest';
import { computeCenteredTourPosition } from '../useAnchoredTourLayout';

describe('computeCenteredTourPosition', () => {
  it('centers the modal in the viewport', () => {
    const pos = computeCenteredTourPosition(400, 200, { width: 1280, height: 800 }, 8);
    expect(pos.left).toBe((1280 - 400) / 2);
    expect(pos.top).toBe((800 - 200) / 2);
  });

  it('keeps the modal inside the viewport when it is larger than available space', () => {
    const pos = computeCenteredTourPosition(2000, 1200, { width: 800, height: 600 }, 8);
    expect(pos.left).toBe(8);
    expect(pos.top).toBe(8);
  });
});
