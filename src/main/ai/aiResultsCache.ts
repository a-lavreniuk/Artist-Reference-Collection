type CachedAiResults = {
  cards: unknown[];
  at: number;
};

const cache = new Map<string, CachedAiResults>();
const MAX = 4;

export function getCachedAiResults(key: string): unknown[] | null {
  return cache.get(key)?.cards ?? null;
}

export function setCachedAiResults(key: string, cards: unknown[]): unknown[] {
  while (cache.size >= MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
    else break;
  }
  cache.set(key, { cards, at: Date.now() });
  return cards;
}

export async function getOrBuildAiResultsPage(
  key: string,
  offset: number,
  limit: number,
  buildAll: () => Promise<unknown[]>
): Promise<unknown[]> {
  let entry = cache.get(key);
  if (!entry) {
    entry = { cards: await buildAll(), at: Date.now() };
    while (cache.size >= MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
      else break;
    }
    cache.set(key, entry);
  }
  return entry.cards.slice(offset, offset + limit);
}

export function clearAiResultsCache(): void {
  cache.clear();
}
