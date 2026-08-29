import { listCardIdsPage } from '../../services/db';
import { DETAIL_QUEUE_RADIUS } from './cardDetailQueueCards';
import type { GalleryFeedQuery } from './galleryQuery';

export const SELECT_ALL_IDS_CAP = 10_000;

function queryToListParams(query: GalleryFeedQuery) {
  return {
    libraryScope: query.libraryScope,
    selectedTagIds: query.selectedTagIds,
    cardIdExact: query.cardIdExact,
    collectionId: query.collectionId,
    moodboardCardIds: query.moodboardCardIds,
    advancedFilters: query.advancedFilters,
    sort: query.sort
  };
}

/**
 * Список id раздела по текущему фильтру — для «выделить всё».
 * Один запрос только с идентификаторами, без полных карточек.
 */
export async function listAllCardIdsForQuery(query: GalleryFeedQuery): Promise<string[]> {
  return listCardIdsPage({
    offset: 0,
    limit: SELECT_ALL_IDS_CAP,
    ...queryToListParams(query)
  });
}

/** Окно id вокруг открытой карточки — очередь деталки в коллекции. */
export async function listCardIdsAroundForQuery(
  query: GalleryFeedQuery,
  centerId: string,
  radius = DETAIL_QUEUE_RADIUS
): Promise<string[]> {
  if (!centerId) return [];
  return listCardIdsPage({
    offset: 0,
    limit: radius * 2 + 1,
    aroundCardId: centerId,
    radius,
    ...queryToListParams(query)
  });
}
