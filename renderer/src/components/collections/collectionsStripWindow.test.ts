import { describe, expect, it } from 'vitest';
import { collectionsStripMetrics, collectionsStripVisibleRange } from './collectionsStripWindow';

describe('collectionsStripWindow', () => {
  it('covers the viewport plus overscan', () => {
    const { stride } = collectionsStripMetrics(20);
    const range = collectionsStripVisibleRange(0, stride * 2, 20, stride);
    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThan(2);
    expect(range.end).toBeLessThanOrEqual(20);
  });

  it('shifts the window when scrolled', () => {
    const { stride } = collectionsStripMetrics(30);
    const range = collectionsStripVisibleRange(stride * 10, stride * 3, 30, stride);
    expect(range.start).toBeGreaterThan(0);
    expect(range.end).toBeLessThan(30);
    expect(range.end - range.start).toBeGreaterThan(3);
  });
});
