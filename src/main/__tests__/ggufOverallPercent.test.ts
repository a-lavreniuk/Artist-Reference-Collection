import { describe, expect, it } from 'vitest';

import { ggufOverallPercent, HF_FILE_PROGRESS_SCALE, scaledDownloadPercent } from '../ai/downloadGguf';

describe('ggufOverallPercent', () => {
  it('keeps a two-file model on one bar: first file 100% is 50%, second starts at 50%', () => {
    expect(ggufOverallPercent(0, 2, 0)).toBe(0);
    expect(ggufOverallPercent(0, 2, 100)).toBe(50);
    expect(ggufOverallPercent(1, 2, 0)).toBe(50);
    expect(ggufOverallPercent(1, 2, 100)).toBe(100);
  });

  it('does not restart from 0 when the second file begins', () => {
    const endOfFirst = ggufOverallPercent(0, 2, 100);
    const startOfSecond = ggufOverallPercent(1, 2, 0);
    expect(startOfSecond).toBeGreaterThanOrEqual(endOfFirst);
  });

  it('uses 0–100 per file so Medium/Heavy/JoyCaption do not stall near 0% on the first GGUF', () => {
    expect(HF_FILE_PROGRESS_SCALE).toBe(100);
    expect(scaledDownloadPercent(0.4)).toBe(40);
    expect(ggufOverallPercent(0, 2, scaledDownloadPercent(0.4))).toBe(20);
    expect(ggufOverallPercent(0, 2, scaledDownloadPercent(1))).toBe(50);
    expect(ggufOverallPercent(1, 2, scaledDownloadPercent(0))).toBe(50);
    expect(ggufOverallPercent(1, 2, scaledDownloadPercent(0.5))).toBe(75);
  });
});
