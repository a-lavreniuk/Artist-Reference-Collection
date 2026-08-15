import { CARD_RATING_MAX, clampCardRating } from './cardRating';

/**
 * Максимальный бонус за 5 звёзд. Та же величина, что `captionTextBoostMax` в hybrid fusion (0.18).
 * Добавляется только после отсечки по релевантности, чтобы не протаскивать слабые совпадения в выдачу.
 */
export const RATING_SEARCH_BOOST_MAX = 0.18;

/** Линейный бонус: 0 звёзд / без оценки → 0; 5 звёзд → `RATING_SEARCH_BOOST_MAX`. */
export function computeRatingSearchBoost(rating: unknown): number {
  const stars = clampCardRating(rating);
  if (stars <= 0) return 0;
  return (stars / CARD_RATING_MAX) * RATING_SEARCH_BOOST_MAX;
}

/** Сырой rank «меньше = лучше» (bm25, ΔE) → 0…1, где 1 — лучший в наборе. */
export function normalizeLowerIsBetter(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  if (span <= 0) return values.map(() => 1);
  return values.map((v) => (max - v) / span);
}

/** Расстояние до порога (ΔE и т.п.) → релевантность 0…1. */
export function relevanceFromClampedDistance(distance: number, maxDistance: number): number {
  if (!(maxDistance > 0) || !Number.isFinite(distance)) return 1;
  return Math.max(0, 1 - distance / maxDistance);
}

/**
 * Добавляет бонус рейтинга к уже отсечённым хитам и сортирует по убыванию score.
 * Новые id не появляются: карточки вне списка не учитываются.
 */
export function applyRatingSearchBoost<T extends { cardId: string; score: number }>(
  items: readonly T[],
  ratingByCardId: ReadonlyMap<string, number>
): T[] {
  if (items.length === 0) return [];
  return items
    .map((item) => ({
      ...item,
      score: item.score + computeRatingSearchBoost(ratingByCardId.get(item.cardId) ?? 0)
    }))
    .sort((a, b) => b.score - a.score);
}

/** Среди уже найденных совпадений: нормировать raw score (меньше = лучше) и добавить бонус рейтинга. */
export function rankMatchedHitsByLowerScoreAndRating(
  hits: ReadonlyArray<{ id: string; rawScore: number; rating: number }>
): string[] {
  if (hits.length === 0) return [];
  const normalized = normalizeLowerIsBetter(hits.map((h) => h.rawScore));
  return hits
    .map((h, i) => ({
      id: h.id,
      score: normalized[i] + computeRatingSearchBoost(h.rating)
    }))
    .sort((a, b) => b.score - a.score)
    .map((h) => h.id);
}
