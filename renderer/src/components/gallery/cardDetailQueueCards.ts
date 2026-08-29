import { listCardsPage, type CardRecord } from '../../services/db';

const CHUNK = 400;
/** Сколько соседей грузить в очередь деталки с каждой стороны. */
export const DETAIL_QUEUE_RADIUS = 24;

export function sliceIdsAround(ids: readonly string[], centerId: string, radius = DETAIL_QUEUE_RADIUS): string[] {
  if (ids.length === 0) return [];
  const i = ids.indexOf(centerId);
  if (i < 0) return [...ids.slice(0, radius * 2 + 1)];
  const from = Math.max(0, i - radius);
  const to = Math.min(ids.length, i + radius + 1);
  return [...ids.slice(from, to)];
}

const CARD_CACHE_MAX = 80;

export function rememberCardInCache(cache: Map<string, CardRecord>, card: CardRecord): void {
  if (cache.has(card.id)) cache.delete(card.id);
  cache.set(card.id, card);
  while (cache.size > CARD_CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export async function loadCardsInOrder(ids: readonly string[]): Promise<CardRecord[]> {
  if (ids.length === 0) return [];
  const byId = new Map<string, CardRecord>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await listCardsPage({
      offset: 0,
      limit: chunk.length,
      libraryScope: 'all',
      selectedTagIds: [],
      moodboardCardIds: [...chunk]
    });
    for (const row of rows) byId.set(row.id, row);
  }
  const ordered: CardRecord[] = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (card) ordered.push(card);
  }
  return ordered;
}
