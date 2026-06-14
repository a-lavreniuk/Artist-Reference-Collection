/** Повторяющиеся query-параметры `tag=` — выбранные метки (AND). */
export const ARC_SEARCH_QUERY_TAG = 'tag';
/** Один параметр `card=` — фильтр ленты по id (вместе с типом и метками). Открытие оверлея — `detail=` (см. openCardUrl.ts). */
export const ARC_SEARCH_QUERY_CARD = 'card';
/** Текстовый AI-запрос семантического поиска. */
export const ARC_SEARCH_QUERY_AI = 'ai';

export function parseSearchTagIds(searchParams: URLSearchParams): string[] {
  return [...new Set(searchParams.getAll(ARC_SEARCH_QUERY_TAG).filter((id) => id.trim().length > 0))];
}

export function parseSearchCardId(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_CARD)?.trim();
  return raw || null;
}

export function parseSearchAiQuery(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_AI)?.trim();
  return raw || null;
}

export function setSearchAiInParams(prev: URLSearchParams, query: string | null): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  if (query && query.trim()) {
    next.set(ARC_SEARCH_QUERY_AI, query.trim());
  }
  return next;
}
