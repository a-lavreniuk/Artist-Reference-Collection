import type { GalleryCollectionsSortMode } from '../../services/appPreferences';
import type { CollectionRecord } from '../../services/db';
import { orderRecordsByIds, shuffleCardIds } from '../gallery/shuffleCardIds';

export function filterNonEmptyCollections(
  collections: readonly CollectionRecord[],
  counts: Record<string, number>
): CollectionRecord[] {
  return collections.filter((col) => (counts[col.id] ?? 0) > 0);
}

export function sortCollectionsForGalleryStrip(
  collections: readonly CollectionRecord[],
  counts: Record<string, number>,
  mode: GalleryCollectionsSortMode,
  randomSeed: number
): CollectionRecord[] {
  const nonEmpty = filterNonEmptyCollections(collections, counts);
  if (nonEmpty.length <= 1) return [...nonEmpty];

  if (mode === 'count') {
    return [...nonEmpty].sort((a, b) => {
      const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  if (mode === 'random') {
    const ids = shuffleCardIds(
      nonEmpty.map((c) => c.id),
      randomSeed
    );
    return orderRecordsByIds(nonEmpty, ids);
  }

  return [...nonEmpty].sort((a, b) => {
    const diff = b.createdAt.localeCompare(a.createdAt);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'ru');
  });
}
