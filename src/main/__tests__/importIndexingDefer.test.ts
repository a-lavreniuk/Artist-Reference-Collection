import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMPORT_INDEXING_IDLE_MS,
  deferCardsForImportIndexing,
  flushDeferredImportIndexing,
  peekDeferredImportIndexingState,
  resetDeferredImportIndexingForTests,
  scheduleDeferredImportIndexingAfterQueueIdle,
  setImportIndexingFlushHandler,
  setManualImportActive
} from '../importIndexingDefer';

describe('importIndexingDefer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDeferredImportIndexingForTests();
  });

  afterEach(() => {
    resetDeferredImportIndexingForTests();
    vi.useRealTimers();
  });

  it('does not flush while collecting ids until queue idle + delay', async () => {
    const flush = vi.fn();
    setImportIndexingFlushHandler(flush);

    deferCardsForImportIndexing(['a', 'b']);
    expect(peekDeferredImportIndexingState().pendingCount).toBe(2);
    expect(flush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(IMPORT_INDEXING_IDLE_MS);
    expect(flush).not.toHaveBeenCalled();

    scheduleDeferredImportIndexingAfterQueueIdle();
    expect(peekDeferredImportIndexingState().timerArmed).toBe(true);

    await vi.advanceTimersByTimeAsync(IMPORT_INDEXING_IDLE_MS - 1);
    expect(flush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(flush).toHaveBeenCalledWith(['a', 'b']);
    expect(peekDeferredImportIndexingState().pendingCount).toBe(0);
  });

  it('cancels idle timer when manual import becomes active', async () => {
    const flush = vi.fn();
    setImportIndexingFlushHandler(flush);
    deferCardsForImportIndexing(['x']);
    scheduleDeferredImportIndexingAfterQueueIdle();

    setManualImportActive(true);
    expect(peekDeferredImportIndexingState().timerArmed).toBe(false);

    await vi.advanceTimersByTimeAsync(IMPORT_INDEXING_IDLE_MS);
    expect(flush).not.toHaveBeenCalled();
    expect(peekDeferredImportIndexingState().pendingCount).toBe(1);
  });

  it('does not flush while import is active even if flush called', async () => {
    const flush = vi.fn();
    setImportIndexingFlushHandler(flush);
    deferCardsForImportIndexing(['x']);
    setManualImportActive(true);
    const ids = await flushDeferredImportIndexing();
    expect(ids).toEqual([]);
    expect(flush).not.toHaveBeenCalled();
  });

  it('dedupes ids on flush', async () => {
    const flush = vi.fn();
    setImportIndexingFlushHandler(flush);
    deferCardsForImportIndexing(['a', 'a', 'b']);
    const ids = await flushDeferredImportIndexing();
    expect(ids).toEqual(['a', 'b']);
    expect(flush).toHaveBeenCalledWith(['a', 'b']);
  });
});
