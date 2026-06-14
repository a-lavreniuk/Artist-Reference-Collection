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
