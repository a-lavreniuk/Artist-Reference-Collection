export type CardFeedNeighbors = {
  prev: string | null;
  next: string | null;
};

export function resolveCardFeedNeighbors(
  cardId: string,
  feedCardIds: readonly string[]
): CardFeedNeighbors {
  const index = feedCardIds.indexOf(cardId);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? (feedCardIds[index - 1] ?? null) : null,
    next: index < feedCardIds.length - 1 ? (feedCardIds[index + 1] ?? null) : null
  };
}

/** Кнопки листания скрыты, если в группе нет ни одного соседа. */
export function shouldShowDetailNavButtons(neighbors?: CardFeedNeighbors): boolean {
  if (!neighbors) return false;
  return Boolean(neighbors.prev || neighbors.next);
}

/** Соседи для prefetch оригинала: prev/next и ±radius в очереди, без текущей карточки. */
export function collectDetailPrefetchCardIds(
  currentId: string,
  neighbors?: CardFeedNeighbors,
  queueIds?: readonly string[],
  radius = 2
): string[] {
  const ids = new Set<string>();
  if (neighbors?.prev) ids.add(neighbors.prev);
  if (neighbors?.next) ids.add(neighbors.next);
  if (queueIds && queueIds.length > 0) {
    const index = queueIds.indexOf(currentId);
    if (index >= 0) {
      for (let offset = -radius; offset <= radius; offset += 1) {
        if (offset === 0) continue;
        const id = queueIds[index + offset];
        if (id) ids.add(id);
      }
    }
  }
  ids.delete(currentId);
  return [...ids];
}
