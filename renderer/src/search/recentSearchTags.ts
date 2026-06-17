const STORAGE_KEY = 'arc.search.recentTagIds';
const HAS_SEARCHED_KEY = 'arc.search.hasCompletedSearchSession';
const MAX_RECENT = 20;

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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

/** После первого полного цикла «открыл → искал → закрыл» показываем блок недавних. */
export function hasCompletedSearchSession(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HAS_SEARCHED_KEY) === '1';
}

export function markSearchSessionCompleted(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HAS_SEARCHED_KEY, '1');
}

export function getRecentTagIds(): string[] {
  return readIds();
}

/** Добавить метку в начало списка недавних (лимит 20). */
export function pushRecentTagId(tagId: string): void {
  if (!tagId.trim()) return;
  const prev = readIds().filter((id) => id !== tagId);
  writeIds([tagId, ...prev]);
}

export function removeRecentTagId(tagId: string): void {
  writeIds(readIds().filter((id) => id !== tagId));
}

export function clearAllRecentTagIds(): void {
  writeIds([]);
}
