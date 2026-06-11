import type Database from 'better-sqlite3';

const FTS_TABLE = 'cards_fts';

export type FtsTextColumn = 'description' | 'link_url';

function ftsTableExists(db: Database.Database): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(FTS_TABLE) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

/** Создаёт FTS5-индекс карточек и триггеры синхронизации с `cards`. */
export function ensureCardsFtsSchema(db: Database.Database): void {
  if (ftsTableExists(db)) return;

  db.exec(`
    CREATE VIRTUAL TABLE ${FTS_TABLE} USING fts5(
      card_id UNINDEXED,
      description,
      link_url,
      tokenize='unicode61'
    );

    CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url)
      VALUES (new.id, COALESCE(new.description, ''), COALESCE(new.link_url, ''));
    END;

    CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
    END;

    CREATE TRIGGER cards_fts_au AFTER UPDATE ON cards BEGIN
      DELETE FROM ${FTS_TABLE} WHERE card_id = old.id;
      INSERT INTO ${FTS_TABLE}(card_id, description, link_url)
      VALUES (new.id, COALESCE(new.description, ''), COALESCE(new.link_url, ''));
    END;
  `);

  db.exec(`
    INSERT INTO ${FTS_TABLE}(card_id, description, link_url)
    SELECT id, COALESCE(description, ''), COALESCE(link_url, '') FROM cards;
  `);
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
