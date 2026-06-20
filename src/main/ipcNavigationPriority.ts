/** Навигационные IPC (list-cards) не должны ждать sidebar/strip/meta. */

let listCardsInFlight = 0;
let navigationEpoch = 0;

export function enterListCardsHandler(): void {
  listCardsInFlight += 1;
}

export function exitListCardsHandler(): void {
  listCardsInFlight = Math.max(0, listCardsInFlight - 1);
}

export function isListCardsInFlight(): boolean {
  return listCardsInFlight > 0;
}

/** Preload sendSync перед list-cards — фоновые задачи main уступают навигации. */
export function beginNavigationEpoch(): number {
  navigationEpoch += 1;
  return navigationEpoch;
}

export function endNavigationEpoch(): void {
  /* epoch не откатываем — фоновые задачи сравнивают snapshot на входе в цикл */
}

export function getNavigationEpoch(): number {
  return navigationEpoch;
}

/** Фоновые задачи (backfill, duplicate-scan) уступают list-cards. */
export async function waitForNavigationIpc(): Promise<void> {
  for (let i = 0; i < 512; i++) {
    if (!isListCardsInFlight()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

/** Уступить event loop — list-cards / навигация важнее sidebar/strip/meta. */
export async function yieldForNavigationIpc(): Promise<void> {
  await waitForNavigationIpc();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Фоновый цикл: прерваться, если началась навигация после старта задачи. */
export function isNavigationEpochStale(snap: number): boolean {
  return snap !== navigationEpoch;
}

export function captureNavigationEpoch(): number {
  return navigationEpoch;
}
