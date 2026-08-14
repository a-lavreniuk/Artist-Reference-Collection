import { describe, expect, it } from 'vitest';
import {
  IMPORT_QUEUE_MAX_PATHS,
  countQueuedPaths,
  formatImportEta,
  tryEnqueueImportJob,
  type ImportQueueJob
} from '../importQueue';

describe('importQueue', () => {
  it('enqueues files and counts paths', () => {
    const queue: ImportQueueJob[] = [];
    const r = tryEnqueueImportJob(queue, { kind: 'files', paths: ['a.jpg', 'b.jpg'] }, { blocked: false });
    expect(r).toEqual({ ok: true, accepted: 2, queuedTotal: 2 });
    expect(countQueuedPaths(queue)).toBe(2);
  });

  it('blocks while modal is open', () => {
    const queue: ImportQueueJob[] = [];
    const r = tryEnqueueImportJob(queue, { kind: 'files', paths: ['a.jpg'] }, { blocked: true });
    expect(r).toEqual({ ok: false, reason: 'blocked', accepted: 0, queuedTotal: 0 });
    expect(queue).toHaveLength(0);
  });

  it('rejects when over limit and accepts partial files', () => {
    const queue: ImportQueueJob[] = [];
    tryEnqueueImportJob(queue, { kind: 'files', paths: ['1.jpg', '2.jpg'] }, { blocked: false, maxPaths: 3 });
    const r = tryEnqueueImportJob(
      queue,
      { kind: 'files', paths: ['3.jpg', '4.jpg', '5.jpg'] },
      { blocked: false, maxPaths: 3 }
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected limit');
    expect(r.reason).toBe('limit');
    expect(r.accepted).toBe(1);
    expect(r.queuedTotal).toBe(3);
    expect(countQueuedPaths(queue)).toBe(3);
  });

  it('rejects folder job that does not fit entirely', () => {
    const queue: ImportQueueJob[] = [{ kind: 'files', paths: Array.from({ length: 499 }, (_, i) => `${i}.jpg`) }];
    const r = tryEnqueueImportJob(
      queue,
      { kind: 'folders', folderPaths: ['a', 'b'], plan: {}, looseFiles: [] },
      { blocked: false, maxPaths: IMPORT_QUEUE_MAX_PATHS }
    );
    expect(r).toMatchObject({ ok: false, reason: 'limit', accepted: 0 });
  });

  it('formats ETA', () => {
    expect(formatImportEta(null)).toBeNull();
    expect(formatImportEta(500)).toBe('~1 сек');
    expect(formatImportEta(90_000)).toBe('~2 мин');
  });

  it('preserves paste flags when slicing a files job', () => {
    const queue: ImportQueueJob[] = [];
    const r = tryEnqueueImportJob(
      queue,
      {
        kind: 'files',
        paths: ['a.png', 'b.png'],
        skipSourceFiles: true,
        deleteAfterImport: true,
        assignCollectionId: 'col-1'
      },
      { blocked: false, maxPaths: 1 }
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected limit');
    expect(r.accepted).toBe(1);
    expect(queue[0]).toMatchObject({
      kind: 'files',
      paths: ['a.png'],
      skipSourceFiles: true,
      deleteAfterImport: true,
      assignCollectionId: 'col-1'
    });
  });
});
