/**
 * Shared tag/category catalog for the container folder «Библиотека ARC».
 * Lives at `<container>/meta/arc-catalog.db`. Card↔tag links stay in each child library DB.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { mkdirSync } from 'fs';
import path from 'path';
import {
  getActiveLibraryEntry,
  readLibraryRootConfigSync,
  type LibraryRegistryEntry
} from '../librarySessionSnapshot';
import { LIBRARY_META_DIR } from '../libraryFilenames';
import { INDEX_DB_FILENAME } from '../libraryFilenames';
import type { CategoryRow, TagRow } from './types';

export const CATALOG_DB_FILENAME = 'arc-catalog.db';

export type CategoryVisibilityMode = 'all' | 'libraries';

export type CategoryWithVisibility = CategoryRow & {
  visibilityMode: CategoryVisibilityMode;
  visibilityLibraryIds: string[];
  /** Computed for the active (or given) library id. */
  visibleInActive: boolean;
};

const CATALOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  weight TEXT NOT NULL DEFAULT 'neutral',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  description TEXT,
  visibility_mode TEXT NOT NULL DEFAULT 'all'
);

CREATE TABLE IF NOT EXISTS category_visibility_libs (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  library_id TEXT NOT NULL,
  PRIMARY KEY (category_id, library_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  tooltip_image TEXT
);

CREATE TABLE IF NOT EXISTS catalog_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_tags_category ON tags(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_vis_libs ON category_visibility_libs(library_id);
`;

let catalogDb: Database.Database | null = null;
let catalogRoot: string | null = null;

export function catalogDbPath(containerPath: string): string {
  return path.join(path.resolve(containerPath), LIBRARY_META_DIR, CATALOG_DB_FILENAME);
}

export function resolveContainerPath(): string | null {
  const cfg = readLibraryRootConfigSync();
  if (cfg.parentPath?.trim()) return path.resolve(cfg.parentPath.trim());
  const active = getActiveLibraryEntry(cfg);
  if (active?.path) return path.dirname(path.resolve(active.path));
  return null;
}

export function closeTagCatalogDb(): void {
  if (catalogDb) {
    try {
      catalogDb.close();
    } catch {
      /* ignore */
    }
    catalogDb = null;
    catalogRoot = null;
  }
}

export function openTagCatalogDb(containerPath?: string | null): Database.Database | null {
  const container = containerPath?.trim()
    ? path.resolve(containerPath.trim())
    : resolveContainerPath();
  if (!container) return null;

  if (catalogDb && catalogRoot === container) return catalogDb;

  closeTagCatalogDb();
  mkdirSync(path.join(container, LIBRARY_META_DIR), { recursive: true });
  const dbPath = catalogDbPath(container);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CATALOG_SCHEMA);
  ensureCatalogSchema(db);
  catalogDb = db;
  catalogRoot = container;
  return db;
}

function ensureCatalogSchema(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(categories)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'visibility_mode')) {
    db.exec(`ALTER TABLE categories ADD COLUMN visibility_mode TEXT NOT NULL DEFAULT 'all'`);
  }
  if (!cols.some((c) => c.name === 'description')) {
    db.exec('ALTER TABLE categories ADD COLUMN description TEXT');
  }
}

function requireCatalogDb(): Database.Database {
  const db = openTagCatalogDb();
  if (!db) throw new Error('Контейнер библиотек не настроен');
  return db;
}

export function isCategoryVisibleInLibrary(
  categoryId: string,
  libraryId: string | null | undefined,
  db: Database.Database = requireCatalogDb()
): boolean {
  const row = db.prepare('SELECT visibility_mode FROM categories WHERE id = ?').get(categoryId) as
    | { visibility_mode: string }
    | undefined;
  if (!row) return false;
  if (row.visibility_mode === 'all') return true;
  if (!libraryId) return false;
  const hit = db
    .prepare('SELECT 1 AS ok FROM category_visibility_libs WHERE category_id = ? AND library_id = ?')
    .get(categoryId, libraryId) as { ok: number } | undefined;
  return Boolean(hit);
}

export function isTagVisibleInLibrary(tagId: string, libraryId: string | null | undefined): boolean {
  const db = openTagCatalogDb();
  if (!db) return false;
  const tag = db.prepare('SELECT category_id FROM tags WHERE id = ?').get(tagId) as
    | { category_id: string }
    | undefined;
  if (!tag) return false;
  return isCategoryVisibleInLibrary(tag.category_id, libraryId, db);
}

function mapCategory(
  row: Record<string, unknown>,
  libraryIds: string[],
  activeLibraryId: string | null
): CategoryWithVisibility {
  const mode: CategoryVisibilityMode = row.visibility_mode === 'libraries' ? 'libraries' : 'all';
  const visibleInActive =
    mode === 'all' ? true : activeLibraryId ? libraryIds.includes(activeLibraryId) : false;
  return {
    id: String(row.id),
    name: String(row.name),
    colorHex: String(row.color_hex),
    weight: row.weight as CategoryRow['weight'],
    sortIndex: Number(row.sort_index),
    createdAt: String(row.created_at),
    ...(row.description ? { description: String(row.description) } : {}),
    visibilityMode: mode,
    visibilityLibraryIds: libraryIds,
    visibleInActive
  };
}

function visibilityLibsFor(db: Database.Database, categoryId: string): string[] {
  return db
    .prepare('SELECT library_id FROM category_visibility_libs WHERE category_id = ?')
    .all(categoryId)
    .map((r) => String((r as { library_id: string }).library_id));
}

export function listCatalogCategories(activeLibraryId?: string | null): CategoryWithVisibility[] {
  const db = openTagCatalogDb();
  if (!db) return [];
  const activeId =
    activeLibraryId === undefined
      ? (getActiveLibraryEntry()?.id ?? null)
      : activeLibraryId;
  return db
    .prepare('SELECT * FROM categories ORDER BY sort_index ASC, created_at ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      return mapCategory(row, visibilityLibsFor(db, String(row.id)), activeId);
    });
}

export function getCatalogCategory(categoryId: string): CategoryWithVisibility | null {
  const db = openTagCatalogDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const activeId = getActiveLibraryEntry()?.id ?? null;
  return mapCategory(row, visibilityLibsFor(db, categoryId), activeId);
}

export function listCatalogTagsByCategory(categoryId: string): TagRow[] {
  const db = openTagCatalogDb();
  if (!db) return [];
  return db
    .prepare('SELECT * FROM tags WHERE category_id = ? ORDER BY name ASC')
    .all(categoryId)
    .map(mapTagRow);
}

export function listAllCatalogTags(): TagRow[] {
  const db = openTagCatalogDb();
  if (!db) return [];
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all().map(mapTagRow);
}

function mapTagRow(r: unknown): TagRow {
  const row = r as Record<string, unknown>;
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    name: String(row.name),
    usageCount: Number(row.usage_count ?? 0),
    description: row.description ? String(row.description) : undefined,
    tooltipImage: row.tooltip_image ? String(row.tooltip_image) : undefined
  };
}

export type UpsertCategoryInput = CategoryRow & {
  visibilityMode?: CategoryVisibilityMode;
  visibilityLibraryIds?: string[];
};

export function upsertCatalogCategory(cat: UpsertCategoryInput): void {
  const db = requireCatalogDb();
  const mode: CategoryVisibilityMode = cat.visibilityMode === 'libraries' ? 'libraries' : 'all';
  const libs = mode === 'libraries' ? [...new Set(cat.visibilityLibraryIds ?? [])] : [];

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(cat.id);
  if (!existing) {
    const clash = db
      .prepare('SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ?')
      .get(cat.name.trim(), cat.id) as { id: string } | undefined;
    if (clash) throw new Error('Категория с таким именем уже есть');
  } else {
    const clash = db
      .prepare('SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ?')
      .get(cat.name.trim(), cat.id) as { id: string } | undefined;
    if (clash) throw new Error('Категория с таким именем уже есть');
  }

  db.prepare(
    `INSERT INTO categories (id, name, color_hex, weight, sort_index, created_at, description, visibility_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color_hex=excluded.color_hex,
       weight=excluded.weight, sort_index=excluded.sort_index, description=excluded.description,
       visibility_mode=excluded.visibility_mode`
  ).run(
    cat.id,
    cat.name.trim(),
    cat.colorHex,
    cat.weight,
    cat.sortIndex,
    cat.createdAt,
    cat.description ?? null,
    mode
  );

  db.prepare('DELETE FROM category_visibility_libs WHERE category_id = ?').run(cat.id);
  if (mode === 'libraries') {
    const ins = db.prepare(
      'INSERT INTO category_visibility_libs (category_id, library_id) VALUES (?, ?)'
    );
    for (const libId of libs) ins.run(cat.id, libId);
  }
}

export function upsertCatalogTag(tag: TagRow): void {
  const db = requireCatalogDb();
  db.prepare(
    `INSERT INTO tags (id, category_id, name, usage_count, description, tooltip_image)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name,
       usage_count=excluded.usage_count, description=excluded.description, tooltip_image=excluded.tooltip_image`
  ).run(
    tag.id,
    tag.categoryId,
    tag.name,
    tag.usageCount,
    tag.description ?? null,
    tag.tooltipImage ?? null
  );
}

export function deleteCatalogCategory(categoryId: string): string[] {
  const db = requireCatalogDb();
  const tagIds = db
    .prepare('SELECT id FROM tags WHERE category_id = ?')
    .all(categoryId)
    .map((r) => String((r as { id: string }).id));
  db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  return tagIds;
}

export function deleteCatalogTag(tagId: string): void {
  const db = requireCatalogDb();
  db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
}

export function pruneLibraryFromCategoryVisibility(libraryId: string): void {
  const db = openTagCatalogDb();
  if (!db) return;
  db.prepare('DELETE FROM category_visibility_libs WHERE library_id = ?').run(libraryId);
}

export function setCatalogTagUsage(tagId: string, usageCount: number): void {
  const db = openTagCatalogDb();
  if (!db) return;
  db.prepare('UPDATE tags SET usage_count = ? WHERE id = ?').run(usageCount, tagId);
}

export function recomputeAllCatalogTagUsage(
  countForTag: (tagId: string) => number
): void {
  const db = openTagCatalogDb();
  if (!db) return;
  const tags = db.prepare('SELECT id FROM tags').all() as Array<{ id: string }>;
  const upd = db.prepare('UPDATE tags SET usage_count = ? WHERE id = ?');
  for (const t of tags) {
    upd.run(countForTag(t.id), t.id);
  }
}

export function getCatalogMeta(key: string): string | null {
  const db = openTagCatalogDb();
  if (!db) return null;
  const row = db.prepare('SELECT value FROM catalog_meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setCatalogMeta(key: string, value: string): void {
  const db = requireCatalogDb();
  db.prepare(
    `INSERT INTO catalog_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).run(key, value);
}

export function isCatalogMigrationDone(): boolean {
  return getCatalogMeta('child_catalog_migrated') === '1';
}

export function markCatalogMigrationDone(): void {
  setCatalogMeta('child_catalog_migrated', '1');
}

/** Libraries that currently can see this category (for strip-on-hide). */
export function libraryIdsWithCategoryVisibility(
  categoryId: string,
  allLibraries: LibraryRegistryEntry[]
): string[] {
  const db = openTagCatalogDb();
  if (!db) return [];
  const row = db.prepare('SELECT visibility_mode FROM categories WHERE id = ?').get(categoryId) as
    | { visibility_mode: string }
    | undefined;
  if (!row) return [];
  if (row.visibility_mode === 'all') return allLibraries.map((l) => l.id);
  return visibilityLibsFor(db, categoryId);
}

export function filterVisibleTagIds(tagIds: string[], libraryId: string | null): string[] {
  if (tagIds.length === 0) return [];
  if (!libraryId) return tagIds;
  return tagIds.filter((id) => isTagVisibleInLibrary(id, libraryId));
}

/** Open child index DB read-write without switching global activeDb when possible. */
export function openChildIndexDb(libraryPath: string): Database.Database | null {
  const root = path.resolve(libraryPath);
  const dbPath = path.join(root, LIBRARY_META_DIR, INDEX_DB_FILENAME);
  const flat = path.join(root, INDEX_DB_FILENAME);
  try {
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      return db;
    }
    if (fs.existsSync(flat)) {
      const db = new Database(flat);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      return db;
    }
  } catch {
    return null;
  }
  return null;
}
