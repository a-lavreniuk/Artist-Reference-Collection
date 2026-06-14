import type Database from 'better-sqlite3';

const FTS_TABLE = 'cards_fts';

export type FtsTextColumn = 'description' | 'link_url' | 'ai_caption';

function ftsTableExists(db: Database.Database): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(FTS_TABLE) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function ftsHasAiCaption(db: Database.Database): boolean {
  if (!ftsTableExists(db)) return false;
  const rows = db.prepare(`PRAGMA table_info(${FTS_TABLE})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === 'ai_caption');
}

function createFtsSchema(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE ${FTS_TABLE} USING fts5(
      card_id UNINDEXED,
      description,
      link_url,
      ai_caption,
      tokenize='unicode61'
    );

    CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption)
      VALUES (new.id, COALESCE(new.description, ''), COALESCE(new.link_url, ''), COALESCE(new.ai_caption, ''));
    END;

    CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
    END;

    CREATE TRIGGER cards_fts_au AFTER UPDATE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption)
      VALUES (new.id, COALESCE(new.description, ''), COALESCE(new.link_url, ''), COALESCE(new.ai_caption, ''));
    END;
  `);

  db.exec(`
    INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption)
    SELECT id, COALESCE(description, ''), COALESCE(link_url, ''), COALESCE(ai_caption, '') FROM cards;
  `);
}

function rebuildFtsWithAiCaption(db: Database.Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS cards_fts_ai;
    DROP TRIGGER IF EXISTS cards_fts_ad;
    DROP TRIGGER IF EXISTS cards_fts_au;
    DROP TABLE IF EXISTS ${FTS_TABLE};
  `);
  createFtsSchema(db);
}

/** Создаёт FTS5-индекс карточек и триггеры синхронизации с `cards`. */
export function ensureCardsFtsSchema(db: Database.Database): void {
  if (!ftsTableExists(db)) {
    createFtsSchema(db);
    return;
  }
  if (!ftsHasAiCaption(db)) {
    rebuildFtsWithAiCaption(db);
  }
}

export function upsertCardAiCaptionFts(db: Database.Database, cardId: string, aiCaption: string): void {
  ensureCardsFtsSchema(db);
  db.prepare(`DELETE FROM ${FTS_TABLE} WHERE card_id = ?`).run(cardId);
  const row = db
    .prepare('SELECT description, link_url FROM cards WHERE id = ?')
    .get(cardId) as { description?: string; link_url?: string } | undefined;
  db.prepare(
    `INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption) VALUES (?, ?, ?, ?)`
  ).run(
    cardId,
    row?.description ?? '',
    row?.link_url ?? '',
    aiCaption
  );
}

/** AND-поиск по токенам колонки; каждое слово — префиксное совпадение (`word*`). */
export function buildFtsColumnMatchQuery(
  column: FtsTextColumn,
  keywords: string | undefined
): string | null {
  const parts = (keywords ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return null;

  const terms = parts.map((word) => {
    const escaped = word.replace(/"/g, '""');
    return `"${escaped}"*`;
  });
  return `${column} : (${terms.join(' AND ')})`;
}
