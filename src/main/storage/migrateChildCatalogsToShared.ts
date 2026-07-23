/**
 * One-shot: move categories/tags from each child arc-index.db into shared arc-catalog.db.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { readLibraryRootConfigSync } from '../librarySessionSnapshot';
import { INDEX_DB_FILENAME, LIBRARY_META_DIR } from '../libraryFilenames';
import {
  isCatalogMigrationDone,
  markCatalogMigrationDone,
  openTagCatalogDb,
  upsertCatalogCategory,
  upsertCatalogTag
} from './tagCatalog';
import type { CategoryRow, TagRow } from './types';
import fs from 'fs';

function childIndexPath(libraryPath: string): string | null {
  const root = path.resolve(libraryPath);
  const meta = path.join(root, LIBRARY_META_DIR, INDEX_DB_FILENAME);
  const flat = path.join(root, INDEX_DB_FILENAME);
  if (fs.existsSync(meta)) return meta;
  if (fs.existsSync(flat)) return flat;
  return null;
}

function readChildCategories(db: Database.Database): CategoryRow[] {
  return db
    .prepare('SELECT * FROM categories ORDER BY sort_index ASC, created_at ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        colorHex: String(row.color_hex),
        weight: row.weight as CategoryRow['weight'],
        sortIndex: Number(row.sort_index),
        createdAt: String(row.created_at),
        ...(row.description ? { description: String(row.description) } : {})
      };
    });
}

function readChildTags(db: Database.Database): TagRow[] {
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all().map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      categoryId: String(row.category_id),
      name: String(row.name),
      usageCount: Number(row.usage_count ?? 0),
      description: row.description ? String(row.description) : undefined,
      tooltipImage: row.tooltip_image ? String(row.tooltip_image) : undefined
    };
  });
}

/**
 * Merge child catalogs into shared catalog. Remap card_tags when names collide.
 * Safe to call repeatedly: no-ops after catalog_meta.child_catalog_migrated=1.
 */
export async function migrateChildCatalogsToShared(): Promise<void> {
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath || !cfg.libraries?.length) return;

  openTagCatalogDb(cfg.parentPath);
  if (isCatalogMigrationDone()) return;

  const libs = [...cfg.libraries].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  /** lower(name) → catalog category id */
  const categoryByName = new Map<string, string>();
  /** `${catId}::${lower(tagName)}` → catalog tag id */
  const tagByCatAndName = new Map<string, string>();

  for (const lib of libs) {
    const dbPath = childIndexPath(lib.path);
    if (!dbPath) continue;
    let db: Database.Database;
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    } catch {
      continue;
    }

    try {
      const hasCats = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='categories'`)
        .get();
      if (!hasCats) continue;

      const cats = readChildCategories(db);
      const localCatIdToCatalog = new Map<string, string>();
      /** oldTagId → catalogTagId within this library */
      const localTagRemap = new Map<string, string>();

      for (const cat of cats) {
        const key = cat.name.trim().toLowerCase();
        let catalogCatId = categoryByName.get(key);
        if (!catalogCatId) {
          catalogCatId = cat.id;
          upsertCatalogCategory({
            ...cat,
            visibilityMode: 'all',
            visibilityLibraryIds: []
          });
          categoryByName.set(key, catalogCatId);
        }
        localCatIdToCatalog.set(cat.id, catalogCatId);
      }

      const tags = readChildTags(db);
      for (const tag of tags) {
        const catalogCatId = localCatIdToCatalog.get(tag.categoryId);
        if (!catalogCatId) continue;
        const tkey = `${catalogCatId}::${tag.name.trim().toLowerCase()}`;
        let catalogTagId = tagByCatAndName.get(tkey);
        if (!catalogTagId) {
          catalogTagId = tag.id;
          upsertCatalogTag({
            ...tag,
            id: catalogTagId,
            categoryId: catalogCatId
          });
          tagByCatAndName.set(tkey, catalogTagId);
        }
        if (tag.id !== catalogTagId) {
          localTagRemap.set(tag.id, catalogTagId);
        }
      }

      if (localTagRemap.size > 0) {
        const sel = db.prepare('SELECT card_id, tag_id FROM card_tags').all() as Array<{
          card_id: string;
          tag_id: string;
        }>;
        const del = db.prepare('DELETE FROM card_tags WHERE card_id = ? AND tag_id = ?');
        const ins = db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)');
        for (const row of sel) {
          const next = localTagRemap.get(row.tag_id);
          if (!next || next === row.tag_id) continue;
          del.run(row.card_id, row.tag_id);
          ins.run(row.card_id, next);
        }
      }

      db.exec('DELETE FROM tags');
      db.exec('DELETE FROM categories');
    } finally {
      db.close();
    }
  }

  markCatalogMigrationDone();
}
