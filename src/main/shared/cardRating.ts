/** Оценка карточки: целое 0–5, где 0 — «без оценки». Общий источник для renderer и main. */

export const CARD_RATING_MIN = 0;
export const CARD_RATING_MAX = 5;

export const CARD_RATING_VALUES = [1, 2, 3, 4, 5] as const;

export type CardRatingValue = 0 | 1 | 2 | 3 | 4 | 5;

export function clampCardRating(value: unknown): CardRatingValue {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  if (rounded <= CARD_RATING_MIN) return 0;
  if (rounded >= CARD_RATING_MAX) return CARD_RATING_MAX;
  return rounded as CardRatingValue;
}

/** Значение из БД / JSON: 0 и мусор приводятся к undefined, чтобы не хранить пустую оценку. */
export function normalizeCardRating(value: unknown): CardRatingValue | undefined {
  const rating = clampCardRating(value);
  return rating > 0 ? rating : undefined;
}
