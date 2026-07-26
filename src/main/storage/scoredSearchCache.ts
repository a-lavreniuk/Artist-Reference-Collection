import type { CardIndexRow } from './types';

type Entry = {
  rows: CardIndexRow[];
  at: number;
};

const MAX = 8;
/** Cap rows kept per scored-search key (gallery keeps ≤500 in memory; leave headroom for pages). */
const MAX_ROWS_PER_ENTRY = 2500;
const cache = new Map<string, Entry>();

function clampCachedRows(rows: CardIndexRow[]): CardIndexRow[] {
  return rows.length > MAX_ROWS_PER_ENTRY ? rows.slice(0, MAX_ROWS_PER_ENTRY) : rows;
}

export function getScoredSearchPage(key: string, offset: number, limit: number): CardIndexRow[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.rows.slice(offset, offset + limit);
}

export function setScoredSearchResults(key: string, rows: CardIndexRow[]): void {
  while (cache.size >= MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
    else break;
  }
  cache.set(key, { rows: clampCachedRows(rows), at: Date.now() });
}

export function getOrBuildScoredSearchPage(
  key: string,
  offset: number,
  limit: number,
  buildAll: () => CardIndexRow[]
): CardIndexRow[] {
  let entry = cache.get(key);
  if (!entry) {
    entry = { rows: clampCachedRows(buildAll()), at: Date.now() };
    while (cache.size >= MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
      else break;
    }
    cache.set(key, entry);
  }
  return entry.rows.slice(offset, offset + limit);
}

export async function getOrBuildScoredSearchPageAsync(
  key: string,
  offset: number,
  limit: number,
  buildAll: () => Promise<CardIndexRow[]>
): Promise<CardIndexRow[]> {
  let entry = cache.get(key);
  if (!entry) {
    entry = { rows: clampCachedRows(await buildAll()), at: Date.now() };
    while (cache.size >= MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
      else break;
    }
    cache.set(key, entry);
  }
  return entry.rows.slice(offset, offset + limit);
}

export function invalidateScoredSearchCache(): void {
  cache.clear();
}

export function stableSearchCacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts);
}
