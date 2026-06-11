import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { INDEX_DB_FILENAME, libraryMetaFileAbs } from '../libraryFilenames';
import { ensureCardsFtsSchema } from './cardFts';
import { STORAGE_SCHEMA_VERSION } from './types';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'video')),
  added_at TEXT NOT NULL,
  date_modified TEXT,
  format TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  dominant_color TEXT,
  phash_json TEXT,
  original_rel TEXT NOT NULL,
  thumb_s_rel TEXT NOT NULL,
  thumb_m_rel TEXT NOT NULL,
  thumb_l_rel TEXT NOT NULL,
  description TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  weight TEXT NOT NULL DEFAULT 'neutral',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  tooltip_image TEXT
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_tags (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

CREATE TABLE IF NOT EXISTS card_collections (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, collection_id)
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skipped_duplicate_pairs (
  min_id TEXT NOT NULL,
  max_id TEXT NOT NULL,
  PRIMARY KEY (min_id, max_id)
);

CREATE INDEX IF NOT EXISTS idx_cards_type_added ON cards(type, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_tags_tag ON card_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_card_collections_col ON card_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category_id);
`;

let activeDb: Database.Database | null = null;
let activeRoot: string | null = null;

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function migrateLibraryDbSchema(db: Database.Database): void {
  // Всегда проверяем колонки: user_version мог быть поднят до 3 без ALTER (частичная миграция).
  if (!tableHasColumn(db, 'cards', 'is_deleted')) {
    db.exec('ALTER TABLE cards ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
  }
  if (!tableHasColumn(db, 'cards', 'deleted_at')) {
    db.exec('ALTER TABLE cards ADD COLUMN deleted_at TEXT');
  }
  if (!tableHasColumn(db, 'cards', 'name')) {
    db.exec('ALTER TABLE cards ADD COLUMN name TEXT');
  }
  if (!tableHasColumn(db, 'cards', 'link_url')) {
    db.exec('ALTER TABLE cards ADD COLUMN link_url TEXT');
  }
  if (!tableHasColumn(db, 'cards', 'duration_ms')) {
    db.exec('ALTER TABLE cards ADD COLUMN duration_ms INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_deleted_added ON cards(is_deleted, added_at DESC)');

  ensureCardsFtsSchema(db);

  // .gif classified as video per product spec
  db.prepare("UPDATE cards SET type = 'video' WHERE LOWER(COALESCE(format, '')) = 'gif' AND type = 'image'").run();

  const userVersion = db.pragma('user_version', { simple: true }) as number;
  if (userVersion < STORAGE_SCHEMA_VERSION) {
    db.pragma(`user_version = ${STORAGE_SCHEMA_VERSION}`);
  }
}

export { INDEX_DB_FILENAME };

export function indexDbPath(libraryRoot: string): string {
  return libraryMetaFileAbs(libraryRoot, INDEX_DB_FILENAME);
}

function flatIndexDbPath(libraryRoot: string): string {
  return path.join(path.resolve(libraryRoot), INDEX_DB_FILENAME);
}

export function openLibraryDb(libraryRoot: string): Database.Database {
  const root = path.resolve(libraryRoot);
  if (activeDb && activeRoot === root) return activeDb;
  closeLibraryDb();
  const dbPath = indexDbPath(root);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  // Колонки is_deleted/deleted_at и idx_cards_deleted_added — только после ALTER на старых БД.
  migrateLibraryDbSchema(db);
  activeDb = db;
  activeRoot = root;
  return db;
}

export function getLibraryDb(): Database.Database | null {
  return activeDb;
}

export function closeLibraryDb(): void {
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      /* ignore */
    }
    activeDb = null;
    activeRoot = null;
  }
}

export function libraryUsesNewStorage(libraryRoot: string): boolean {
  try {
    const fs = require('fs') as typeof import('fs');
    const root = path.resolve(libraryRoot);
    return fs.existsSync(indexDbPath(root)) || fs.existsSync(flatIndexDbPath(root));
  } catch {
    return false;
  }
}
