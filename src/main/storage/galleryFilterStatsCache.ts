import type { LibraryScope } from './types';
import type { GalleryFilterStats } from './galleryFilterStats';

type StatsCacheEntry = {
  stats: GalleryFilterStats;
};

let cachedRoot: string | null = null;
let cachedKey: string | null = null;
let cachedEntry: StatsCacheEntry | null = null;

export function buildGalleryFilterStatsCacheKey(opts: {
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
}): string {
  const tagIds = [...(opts.selectedTagIds ?? [])].sort().join('\u0001');
  const moodboardIds = [...(opts.moodboardCardIds ?? [])].sort().join('\u0001');
  return [
    opts.libraryScope ?? 'all',
    tagIds,
    opts.cardIdExact?.trim() ?? '',
    opts.collectionId?.trim() ?? '',
    moodboardIds
  ].join('|');
}

export function getCachedGalleryFilterStats(
  root: string,
  cacheKey: string
): GalleryFilterStats | null {
  if (cachedRoot === root && cachedKey === cacheKey && cachedEntry) {
    return cachedEntry.stats;
  }
  return null;
}

export function setCachedGalleryFilterStats(
  root: string,
  cacheKey: string,
  stats: GalleryFilterStats
): void {
  cachedRoot = root;
  cachedKey = cacheKey;
  cachedEntry = { stats };
}

export function invalidateGalleryFilterStatsCache(): void {
  cachedRoot = null;
  cachedKey = null;
  cachedEntry = null;
}
