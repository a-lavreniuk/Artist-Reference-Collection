import { openLibraryDb } from '../storage/db';
import { buildFtsColumnMatchQuery } from '../storage/cardFts';
import { getCardByIdFromDb } from '../storage/libraryStorage';
import type { CardIndexRow } from '../storage/types';

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
      `SELECT c.id FROM cards c
       INNER JOIN cards_fts ON cards_fts.card_id = c.id
       WHERE cards_fts MATCH ? AND COALESCE(c.is_deleted, 0) = 0
       ORDER BY c.added_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(match, limit, offset) as Array<{ id: string }>;

  const cards: CardIndexRow[] = [];
  for (const row of rows) {
    const card = getCardByIdFromDb(libraryRoot, row.id);
    if (card) cards.push(card);
  }
  return cards;
}
