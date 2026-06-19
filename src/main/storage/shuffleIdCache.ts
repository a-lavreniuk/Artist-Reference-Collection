import { shuffleCardIds } from '../shared/shuffleCardIds';

type CacheEntry = {
  ids: string[];
  at: number;
};

const MAX_ENTRIES = 4;
const cache = new Map<string, CacheEntry>();

function touch(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

export function getCachedShuffledIds(key: string): string[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  touch(key, entry);
  return entry.ids;
}

export function setCachedShuffledIds(key: string, ids: string[]): string[] {
  const shuffled = shuffleCardIds(ids, extractSeedFromKey(key));
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
    else break;
  }
  cache.set(key, { ids: shuffled, at: Date.now() });
  return shuffled;
}

export function buildShuffleCacheKey(
  whereSql: string,
  binds: readonly unknown[],
  shuffleSeed: number
): string {
  return `${shuffleSeed}\0${whereSql}\0${JSON.stringify(binds)}`;
}

function extractSeedFromKey(key: string): number {
  const sep = key.indexOf('\0');
  if (sep <= 0) return 0;
  const n = Number(key.slice(0, sep));
  return Number.isFinite(n) ? n : 0;
}

export function invalidateShuffleIdCache(): void {
  cache.clear();
}

export function getShuffledPageIds(
  key: string,
  loadAllIds: () => string[],
  offset: number,
  limit: number
): string[] {
  let ordered = getCachedShuffledIds(key);
  if (!ordered) {
    ordered = setCachedShuffledIds(key, loadAllIds());
  }
  return ordered.slice(offset, offset + limit);
}
