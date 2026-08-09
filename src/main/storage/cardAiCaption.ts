import type Database from 'better-sqlite3';

export function upsertCardAiCaption(db: Database.Database, cardId: string, caption: string): void {
  db.prepare(
    `UPDATE cards SET ai_caption = ?, ai_caption_at = ? WHERE id = ?`
  ).run(caption, new Date().toISOString(), cardId);
}

export function getCardAiCaption(db: Database.Database, cardId: string): string | null {
  const row = db.prepare('SELECT ai_caption FROM cards WHERE id = ?').get(cardId) as
    | { ai_caption?: string | null }
    | undefined;
  return row?.ai_caption ?? null;
}

/** Batch-load ai_caption for hybrid search literal boost (avoids N+1). */
export function getCardAiCaptionsByIds(
  db: Database.Database,
  cardIds: string[]
): Map<string, string> {
  const out = new Map<string, string>();
  if (cardIds.length === 0) return out;

  const CHUNK = 400;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const chunk = cardIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT id, ai_caption FROM cards WHERE id IN (${placeholders})`)
      .all(...chunk) as Array<{ id: string; ai_caption?: string | null }>;
    for (const row of rows) {
      const caption = row.ai_caption?.trim();
      if (caption) out.set(row.id, caption);
    }
  }
  return out;
}

export function listCardsMissingAiCaption(
  db: Database.Database,
  modelId: string,
  limit: number
): string[] {
  const rows = db
    .prepare(
      `SELECT c.id FROM cards c
       LEFT JOIN card_embeddings e ON e.card_id = c.id AND e.model_id = ?
       WHERE c.is_deleted = 0 AND c.type = 'image'
         AND (c.ai_caption IS NULL OR TRIM(c.ai_caption) = '')
         AND e.card_id IS NULL
       ORDER BY c.added_at DESC
       LIMIT ?`
    )
    .all(modelId, limit) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}
