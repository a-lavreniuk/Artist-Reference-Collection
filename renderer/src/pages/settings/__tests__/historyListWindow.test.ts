import { describe, expect, it } from 'vitest';
import { historyVisibleRange } from '../historyListWindow';

describe('historyVisibleRange', () => {
  it('returns an empty range for an empty list', () => {
    expect(historyVisibleRange(0, 0, 400, 56, 12)).toEqual({ start: 0, end: 0 });
  });

  it('includes overscan around the viewport', () => {
    expect(historyVisibleRange(1000, 560, 280, 56, 12)).toEqual({ start: 0, end: 27 });
  });

  it('clamps to the list bounds', () => {
    expect(historyVisibleRange(20, 800, 400, 56, 12)).toEqual({ start: 2, end: 20 });
  });
});
