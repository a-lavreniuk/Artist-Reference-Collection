const STORAGE_KEY = 'arc.search.recentAiQueries';
const MAX_RECENT = 8;

function readQueries(): string[] {
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

function writeQueries(queries: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queries.slice(0, MAX_RECENT)));
}

export const ARC_RECENT_AI_QUERIES_CHANGED_EVENT = 'arc:recent-ai-queries-changed';

function notifyChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_RECENT_AI_QUERIES_CHANGED_EVENT));
}

export function getRecentAiQueries(): string[] {
  return readQueries();
}

/** Добавить запрос в начало списка недавних (лимит 8). */
export function pushRecentAiQuery(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const prev = readQueries().filter((q) => q !== trimmed);
  writeQueries([trimmed, ...prev]);
  notifyChanged();
}

export function clearAllRecentAiQueries(): void {
  writeQueries([]);
  notifyChanged();
}
