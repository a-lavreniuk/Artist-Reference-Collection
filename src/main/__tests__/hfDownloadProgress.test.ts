import { describe, expect, it } from 'vitest';

import { createHfDownloadProgressAggregator } from '../ai/hfDownloadProgress';

describe('createHfDownloadProgressAggregator', () => {
  it('does not jump to 100% on tiny files when the catalog size is larger', () => {
    const tracker = createHfDownloadProgressAggregator(350 * 1024 * 1024);
    const first = tracker.ingest({
      file: 'config.json',
      loaded: 2048,
      total: 2048,
      status: 'done'
    });
    expect(first.percent).toBeLessThan(2);

    const second = tracker.ingest({
      file: 'tokenizer.json',
      loaded: 4096,
      total: 4096,
      status: 'done'
    });
    expect(second.percent).toBeGreaterThanOrEqual(first.percent);
    expect(second.percent).toBeLessThan(2);
  });

  it('does not restart from 0 when the next file begins at 0%', () => {
    const tracker = createHfDownloadProgressAggregator(350 * 1024 * 1024);
    tracker.ingest({ file: 'a.json', progress: 100, loaded: 1000, total: 1000 });
    const mid = tracker.ingest({
      file: 'model.onnx',
      progress: 40,
      loaded: 80 * 1024 * 1024,
      total: 200 * 1024 * 1024
    });
    const nextFileStart = tracker.ingest({
      file: 'vocab.json',
      progress: 0,
      loaded: 0,
      total: 5000
    });
    expect(nextFileStart.percent).toBeGreaterThanOrEqual(mid.percent);
  });

  it('splits unnamed 0–100 callbacks into separate files without dropping the bar', () => {
    const tracker = createHfDownloadProgressAggregator(100);
    const firstEnd = tracker.ingest({ progress: 100 });
    const secondStart = tracker.ingest({ progress: 0 });
    const secondEnd = tracker.ingest({ progress: 100 });
    expect(firstEnd.percent).toBeGreaterThan(0);
    expect(secondStart.percent).toBeGreaterThanOrEqual(firstEnd.percent);
    expect(secondEnd.percent).toBeGreaterThanOrEqual(secondStart.percent);
  });
});
