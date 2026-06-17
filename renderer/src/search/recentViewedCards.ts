const STORAGE_KEY = 'arc.search.recentViewedCardIds';

export const ARC_RECENT_VIEWS_CHANGED_EVENT = 'arc-recent-views-changed';

export const RECENT_VIEWED_MIN_MS = 3000;
export const MAX_RECENT_VIEWED = 6;

function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_VIEWED)));
}

function notifyChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ARC_RECENT_VIEWS_CHANGED_EVENT));
}

export function getRecentViewedCardIds(): string[] {
  return readIds();
}

/** Добавить карточку в начало списка недавних просмотров (без дублей). */
export function pushRecentViewedCardId(cardId: string): void {
  const id = cardId.trim();
  if (!id) return;
  const prev = readIds().filter((x) => x !== id);
  writeIds([id, ...prev]);
  notifyChanged();
}

export function clearAllRecentViewedCardIds(): void {
  writeIds([]);
  notifyChanged();
}
