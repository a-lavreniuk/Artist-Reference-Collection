/** После опустошения очереди ручного импорта ждём столько, затем индексируем. */
export const IMPORT_INDEXING_IDLE_MS = 10_000;

type IndexCardsFn = (cardIds: string[]) => void | Promise<void>;

let pendingImportCardIds: string[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isManualImportActive = false;
let indexCards: IndexCardsFn | null = null;

/** Подмена для тестов; в проде — динамический import ipcAi. */
export function setImportIndexingFlushHandler(handler: IndexCardsFn | null): void {
  indexCards = handler;
}

export function setManualImportActive(active: boolean): void {
  isManualImportActive = active;
  if (active) {
    cancelDeferredImportIndexingTimer();
  }
}

export function deferCardsForImportIndexing(cardIds: string[]): void {
  for (const id of cardIds) {
    if (id) pendingImportCardIds.push(id);
  }
}

export function cancelDeferredImportIndexingTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Очередь ручного импорта пуста — через IMPORT_INDEXING_IDLE_MS запустить индексацию.
 * Новый импорт сбрасывает таймер через setManualImportActive(true).
 */
export function scheduleDeferredImportIndexingAfterQueueIdle(): void {
  cancelDeferredImportIndexingTimer();
  if (pendingImportCardIds.length === 0) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void flushDeferredImportIndexing();
  }, IMPORT_INDEXING_IDLE_MS);
}

export async function flushDeferredImportIndexing(): Promise<string[]> {
  cancelDeferredImportIndexingTimer();
  if (isManualImportActive) return [];
  const ids = [...new Set(pendingImportCardIds)];
  pendingImportCardIds = [];
  if (ids.length === 0) return [];

  if (indexCards) {
    await indexCards(ids);
  } else {
    const { queueCardsForIndexing } = await import('./ipcAi');
    void queueCardsForIndexing(ids);
  }
  return ids;
}

export function peekDeferredImportIndexingState(): {
  pendingCount: number;
  timerArmed: boolean;
  importActive: boolean;
} {
  return {
    pendingCount: pendingImportCardIds.length,
    timerArmed: idleTimer != null,
    importActive: isManualImportActive
  };
}

export function resetDeferredImportIndexingForTests(): void {
  cancelDeferredImportIndexingTimer();
  pendingImportCardIds = [];
  isManualImportActive = false;
  indexCards = null;
}
