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
