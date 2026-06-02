/** Повторяющиеся query-параметры `tag=` — выбранные метки (AND). */
export const ARC_SEARCH_QUERY_TAG = 'tag';
/** Один параметр `card=` — точное совпадение id карточки вместе с фильтрами по типу и меткам. */
export const ARC_SEARCH_QUERY_CARD = 'card';

export function parseSearchTagIds(searchParams: URLSearchParams): string[] {
  return [...new Set(searchParams.getAll(ARC_SEARCH_QUERY_TAG).filter((id) => id.trim().length > 0))];
}

export function parseSearchCardId(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_CARD)?.trim();
  return raw || null;
}
