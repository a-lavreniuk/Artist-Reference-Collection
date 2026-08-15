import { openLibraryDb } from '../storage/db';
import { buildFtsColumnMatchQuery } from '../storage/cardFts';
import { getCardByIdFromDb } from '../storage/libraryStorage';
import { rankMatchedHitsByLowerScoreAndRating } from '../shared/ratingSearchBoost';
import type { CardIndexRow } from '../storage/types';

/** Верхняя граница совпадений FTS до переранжирования с рейтингом (как у scored-search cache). */
const FTS_RANK_CAP = 2500;

function buildMultiColumnFtsMatch(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const columns = ['description', 'link_url', 'ai_caption'] as const;
  const parts = columns
    .map((col) => buildFtsColumnMatchQuery(col, trimmed))
    .filter((p): p is string => Boolean(p));
  if (!parts.length) return null;
  return parts.join(' OR ');
}

/** Full-text search across description, link URL, and AI caption. */
export function searchCardsByText(
  libraryRoot: string,
  query: string,
  limit: number,
  offset: number
): CardIndexRow[] {
  const match = buildMultiColumnFtsMatch(query);
  if (!match) return [];

  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT c.id AS id, COALESCE(c.rating, 0) AS rating, bm25(cards_fts) AS fts_rank
       FROM cards c
       INNER JOIN cards_fts ON cards_fts.card_id = c.id
       WHERE cards_fts MATCH ? AND COALESCE(c.is_deleted, 0) = 0
       ORDER BY bm25(cards_fts) ASC
       LIMIT ?`
    )
    .all(match, FTS_RANK_CAP) as Array<{ id: string; rating: number; fts_rank: number }>;

  const rankedIds = rankMatchedHitsByLowerScoreAndRating(
    rows.map((row) => {
      const rawScore = Number(row.fts_rank);
      return {
        id: String(row.id),
        rawScore: Number.isFinite(rawScore) ? rawScore : 0,
        rating: Number(row.rating) || 0
      };
    })
  );

  const pageIds = rankedIds.slice(Math.max(0, offset), Math.max(0, offset) + Math.max(1, limit));
  const cards: CardIndexRow[] = [];
  for (const id of pageIds) {
    const card = getCardByIdFromDb(libraryRoot, id);
    if (card) cards.push(card);
  }
  return cards;
}
