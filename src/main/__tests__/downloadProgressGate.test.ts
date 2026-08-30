import { describe, expect, it } from 'vitest';

import { mapRuntimePercent, shouldAcceptDownloadProgress } from '../ai/downloadProgressGate';

describe('shouldAcceptDownloadProgress', () => {
  it('accepts model 0% after runtime 100% even if phase was pre-assigned', () => {
    expect(shouldAcceptDownloadProgress('runtime', 100, 'model', 0)).toBe(true);
    expect(shouldAcceptDownloadProgress('model', 0, 'model', 12)).toBe(true);
    expect(shouldAcceptDownloadProgress('model', 12, 'model', 40)).toBe(true);
  });

  it('keeps ignoring a drop inside the same phase', () => {
    expect(shouldAcceptDownloadProgress('model', 80, 'model', 50)).toBe(false);
    expect(shouldAcceptDownloadProgress('runtime', 100, 'runtime', 50)).toBe(false);
  });

  it('accepts finalize after model 100%', () => {
    expect(shouldAcceptDownloadProgress('model', 100, 'finalize', 0)).toBe(true);
  });
});

describe('mapRuntimePercent', () => {
  it('splits CPU then CUDA into 0–50 and 50–100 without a drop', () => {
    expect(mapRuntimePercent(100, 'lower')).toBe(50);
    expect(mapRuntimePercent(0, 'upper')).toBe(50);
    expect(mapRuntimePercent(100, 'upper')).toBe(100);
    expect(mapRuntimePercent(100, 'full')).toBe(100);
  });
});
