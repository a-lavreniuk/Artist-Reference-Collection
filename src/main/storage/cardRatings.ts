import type Database from 'better-sqlite3';

import { clampCardRating } from '../shared/cardRating';

const IN_CHUNK = 400;

/** Оценка карточек по id. Нет строки / мусор → 0 (без бонуса). */
export function getCardRatingsByIds(db: Database.Database, cardIds: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  if (cardIds.length === 0) return map;

  for (let i = 0; i < cardIds.length; i += IN_CHUNK) {
    const chunk = cardIds.slice(i, i + IN_CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, rating FROM cards WHERE id IN (${placeholders})`).all(...chunk) as Array<{
      id: string;
      rating: unknown;
    }>;
    for (const row of rows) {
      map.set(String(row.id), clampCardRating(row.rating));
    }
  }
  return map;
}
