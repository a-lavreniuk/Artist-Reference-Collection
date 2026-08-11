import { LIST_CARDS_PAGE_SIZE, listCardsPage } from '../../services/db';
import type { GalleryFeedQuery } from './galleryQuery';

/**
 * Полный список id раздела по текущему фильтру — для «выделить всё» в коллекциях
 * и мудборде, где лента подгружается порциями.
 */
export async function listAllCardIdsForQuery(query: GalleryFeedQuery): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  for (;;) {
    const chunk = await listCardsPage({
      offset,
      limit: LIST_CARDS_PAGE_SIZE,
      libraryScope: query.libraryScope,
      selectedTagIds: query.selectedTagIds,
      cardIdExact: query.cardIdExact,
      collectionId: query.collectionId,
      moodboardCardIds: query.moodboardCardIds,
      advancedFilters: query.advancedFilters,
      sort: query.sort
    });
    for (const card of chunk) ids.push(card.id);
    if (chunk.length < LIST_CARDS_PAGE_SIZE) break;
    offset += chunk.length;
  }
  return ids;
}
