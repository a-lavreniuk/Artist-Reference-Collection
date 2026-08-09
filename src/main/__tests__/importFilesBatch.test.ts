import { describe, expect, it, vi } from 'vitest';
import { runImportFilesBatch } from '../importFilesBatch';

describe('runImportFilesBatch', () => {
  it('imports all files and reports progress with eta after first file', async () => {
    const onProgress = vi.fn();
    let clock = 1_000;
    const outcome = await runImportFilesBatch({
      paths: ['a.jpg', 'b.jpg', 'c.jpg'],
      signal: new AbortController().signal,
      now: () => clock,
      importOne: async (p) => {
        clock += 100;
        return { ok: true as const, row: { id: p } };
      },
      onProgress
    });

    expect(outcome.cancelled).toBe(false);
    expect(outcome.results).toHaveLength(3);
    expect(outcome.results.every((r) => r.ok && r.path)).toBe(true);
    expect(onProgress).toHaveBeenCalled();
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ current: 3, total: 3, etaMs: null });
    const mid = onProgress.mock.calls.find((c) => c[0].current === 1)?.[0];
    expect(mid?.etaMs).toBe(200);
  });

  it('keeps path on failures and continues', async () => {
    const outcome = await runImportFilesBatch({
      paths: ['ok.png', 'bad.png'],
      signal: new AbortController().signal,
      importOne: async (p) =>
        p.includes('bad')
          ? { ok: false as const, error: 'Файл недоступен: bad.png' }
          : { ok: true as const, row: { id: '1' } },
      onProgress: () => {}
    });

    expect(outcome.cancelled).toBe(false);
    expect(outcome.results[0]).toMatchObject({ ok: true, path: 'ok.png' });
    expect(outcome.results[1]).toMatchObject({
      ok: false,
      path: 'bad.png',
      error: 'Файл недоступен: bad.png'
    });
  });

  it('finishes current file then stops when aborted', async () => {
    const abort = new AbortController();
    const started: string[] = [];
    const outcome = await runImportFilesBatch({
      paths: ['1.jpg', '2.jpg', '3.jpg'],
      signal: abort.signal,
      importOne: async (p) => {
        started.push(p);
        if (p === '1.jpg') abort.abort();
        return { ok: true as const, row: { id: p } };
      },
      onProgress: () => {}
    });

    expect(started).toEqual(['1.jpg']);
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]).toMatchObject({ ok: true, path: '1.jpg' });
  });

  it('does not start any file if already aborted', async () => {
    const abort = new AbortController();
    abort.abort();
    const importOne = vi.fn();
    const outcome = await runImportFilesBatch({
      paths: ['1.jpg'],
      signal: abort.signal,
      importOne,
      onProgress: () => {}
    });
    expect(importOne).not.toHaveBeenCalled();
    expect(outcome).toEqual({ results: [], cancelled: true });
  });
});
