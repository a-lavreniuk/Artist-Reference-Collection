import type Database from 'better-sqlite3';

const FTS_TABLE = 'cards_fts';

export type FtsTextColumn = 'description' | 'link_url' | 'ai_caption' | 'annotations_text';

function ftsTableExists(db: Database.Database): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(FTS_TABLE) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function ftsHasColumn(db: Database.Database, column: string): boolean {
  if (!ftsTableExists(db)) return false;
  const rows = db.prepare(`PRAGMA table_info(${FTS_TABLE})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function createFtsSchema(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE ${FTS_TABLE} USING fts5(
      card_id UNINDEXED,
      description,
      link_url,
      ai_caption,
      annotations_text,
      tokenize='unicode61'
    );

    CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption, annotations_text)
      VALUES (
        new.id,
        COALESCE(new.description, ''),
        COALESCE(new.link_url, ''),
        COALESCE(new.ai_caption, ''),
        COALESCE(new.annotations_text, '')
      );
    END;

    CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
    END;

    CREATE TRIGGER cards_fts_au AFTER UPDATE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption, annotations_text)
      VALUES (
        new.id,
        COALESCE(new.description, ''),
        COALESCE(new.link_url, ''),
        COALESCE(new.ai_caption, ''),
        COALESCE(new.annotations_text, '')
      );
    END;
  `);

  db.exec(`
    INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption, annotations_text)
    SELECT
      id,
      COALESCE(description, ''),
      COALESCE(link_url, ''),
      COALESCE(ai_caption, ''),
      COALESCE(annotations_text, '')
    FROM cards;
  `);
}

function rebuildFtsSchema(db: Database.Database): void {
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
  if (!ftsTableExists(db) || !ftsHasColumn(db, 'ai_caption') || !ftsHasColumn(db, 'annotations_text')) {
    rebuildFtsSchema(db);
  }
}

export function upsertCardAiCaptionFts(db: Database.Database, cardId: string, aiCaption: string): void {
  ensureCardsFtsSchema(db);
  db.prepare(`DELETE FROM ${FTS_TABLE} WHERE card_id = ?`).run(cardId);
  const row = db
    .prepare('SELECT description, link_url, annotations_text FROM cards WHERE id = ?')
    .get(cardId) as { description?: string; link_url?: string; annotations_text?: string } | undefined;
  db.prepare(
    `INSERT INTO ${FTS_TABLE}(card_id, description, link_url, ai_caption, annotations_text) VALUES (?, ?, ?, ?, ?)`
  ).run(
    cardId,
    row?.description ?? '',
    row?.link_url ?? '',
    aiCaption,
    row?.annotations_text ?? ''
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
