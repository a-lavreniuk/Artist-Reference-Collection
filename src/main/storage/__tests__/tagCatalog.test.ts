import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = path.join(os.tmpdir(), `arc-tag-catalog-test-${process.pid}`);

/** better-sqlite3 is built for Electron; skip under mismatched system Node. */
function canOpenSqlite(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

const sqliteOk = canOpenSqlite();

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(tmpRoot, 'userData');
      return path.join(tmpRoot, name);
    }
  }
}));

const state = {
  parentPath: '' as string,
  libraries: [] as Array<{ id: string; name: string; path: string }>,
  activeLibraryId: null as string | null
};

vi.mock('../../librarySessionSnapshot', () => ({
  readLibraryRootConfigSync: () => ({
    parentPath: state.parentPath || null,
    libraries: state.libraries,
    activeLibraryId: state.activeLibraryId,
    path: state.libraries.find((l) => l.id === state.activeLibraryId)?.path ?? null
  }),
  getActiveLibraryEntry: () =>
    state.libraries.find((l) => l.id === state.activeLibraryId) ?? null,
  replaceLibraryRootConfig: vi.fn()
}));

import Database from 'better-sqlite3';
import {
  closeTagCatalogDb,
  isCategoryVisibleInLibrary,
  listCatalogCategories,
  openTagCatalogDb,
  pruneLibraryFromCategoryVisibility,
  upsertCatalogCategory,
  upsertCatalogTag,
  filterVisibleTagIds,
  isCatalogMigrationDone
} from '../tagCatalog';
import { migrateChildCatalogsToShared } from '../migrateChildCatalogsToShared';
import { LIBRARY_META_DIR, INDEX_DB_FILENAME } from '../../libraryFilenames';

describe.skipIf(!sqliteOk)('tagCatalog visibility', () => {
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpRoot, 'userData'), { recursive: true });
    state.parentPath = path.join(tmpRoot, 'container');
    fs.mkdirSync(path.join(state.parentPath, LIBRARY_META_DIR), { recursive: true });
    state.libraries = [
      { id: 'lib-a', name: 'A', path: path.join(state.parentPath, 'A') },
      { id: 'lib-b', name: 'B', path: path.join(state.parentPath, 'B') }
    ];
    state.activeLibraryId = 'lib-a';
    closeTagCatalogDb();
    openTagCatalogDb(state.parentPath);
  });

  afterEach(() => {
    closeTagCatalogDb();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('defaults new category to visible in all libraries', () => {
    upsertCatalogCategory({
      id: 'c1',
      name: 'Цвет',
      colorHex: '#EAB308',
      weight: 'neutral',
      sortIndex: 0,
      createdAt: new Date().toISOString(),
      visibilityMode: 'all',
      visibilityLibraryIds: []
    });
    expect(isCategoryVisibleInLibrary('c1', 'lib-a')).toBe(true);
    expect(isCategoryVisibleInLibrary('c1', 'lib-b')).toBe(true);
    const listed = listCatalogCategories('lib-a');
    expect(listed[0]?.visibleInActive).toBe(true);
  });

  it('respects libraries mode and prune on library delete', () => {
    upsertCatalogCategory({
      id: 'c2',
      name: 'Стиль',
      colorHex: '#22C55E',
      weight: 'medium',
      sortIndex: 0,
      createdAt: new Date().toISOString(),
      visibilityMode: 'libraries',
      visibilityLibraryIds: ['lib-a', 'lib-b']
    });
    expect(isCategoryVisibleInLibrary('c2', 'lib-a')).toBe(true);
    expect(isCategoryVisibleInLibrary('c2', 'lib-b')).toBe(true);

    upsertCatalogCategory({
      id: 'c2',
      name: 'Стиль',
      colorHex: '#22C55E',
      weight: 'medium',
      sortIndex: 0,
      createdAt: new Date().toISOString(),
      visibilityMode: 'libraries',
      visibilityLibraryIds: ['lib-a']
    });
    expect(isCategoryVisibleInLibrary('c2', 'lib-a')).toBe(true);
    expect(isCategoryVisibleInLibrary('c2', 'lib-b')).toBe(false);

    pruneLibraryFromCategoryVisibility('lib-a');
    expect(isCategoryVisibleInLibrary('c2', 'lib-a')).toBe(false);
    const listed = listCatalogCategories('lib-a');
    expect(listed.find((c) => c.id === 'c2')?.visibleInActive).toBe(false);
  });

  it('filters tag ids by category visibility', () => {
    upsertCatalogCategory({
      id: 'c3',
      name: 'Hidden',
      colorHex: '#000000',
      weight: 'neutral',
      sortIndex: 0,
      createdAt: new Date().toISOString(),
      visibilityMode: 'libraries',
      visibilityLibraryIds: ['lib-b']
    });
    upsertCatalogTag({
      id: 't1',
      categoryId: 'c3',
      name: 'tag',
      usageCount: 0
    });
    expect(filterVisibleTagIds(['t1'], 'lib-a')).toEqual([]);
    expect(filterVisibleTagIds(['t1'], 'lib-b')).toEqual(['t1']);
    expect(filterVisibleTagIds(['t1'], null)).toEqual(['t1']);
  });
});

describe.skipIf(!sqliteOk)('migrateChildCatalogsToShared', () => {
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpRoot, 'userData'), { recursive: true });
    state.parentPath = path.join(tmpRoot, 'container');
    state.libraries = [];
    state.activeLibraryId = null;
    closeTagCatalogDb();
  });

  afterEach(() => {
    closeTagCatalogDb();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function seedChild(
    libName: string,
    libId: string,
    cats: Array<{ id: string; name: string }>,
    tags: Array<{ id: string; categoryId: string; name: string }>
  ) {
    const libPath = path.join(state.parentPath, libName);
    const meta = path.join(libPath, LIBRARY_META_DIR);
    fs.mkdirSync(meta, { recursive: true });
    const db = new Database(path.join(meta, INDEX_DB_FILENAME));
    db.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY, name TEXT, color_hex TEXT, weight TEXT,
        sort_index INTEGER, created_at TEXT, description TEXT
      );
      CREATE TABLE tags (
        id TEXT PRIMARY KEY, category_id TEXT, name TEXT, usage_count INTEGER,
        description TEXT, tooltip_image TEXT
      );
      CREATE TABLE cards (id TEXT PRIMARY KEY, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE card_tags (card_id TEXT, tag_id TEXT, PRIMARY KEY (card_id, tag_id));
    `);
    for (const c of cats) {
      db.prepare(
        `INSERT INTO categories (id, name, color_hex, weight, sort_index, created_at) VALUES (?, ?, '#EAB308', 'neutral', 0, ?)`
      ).run(c.id, c.name, new Date().toISOString());
    }
    for (const t of tags) {
      db.prepare(`INSERT INTO tags (id, category_id, name, usage_count) VALUES (?, ?, ?, 0)`).run(
        t.id,
        t.categoryId,
        t.name
      );
    }
    db.close();
    state.libraries.push({ id: libId, name: libName, path: libPath });
    if (!state.activeLibraryId) state.activeLibraryId = libId;
  }

  it('copies single library catalog once and marks migration done', async () => {
    seedChild('Lib1', 'id1', [{ id: 'cat-local', name: 'Цвет' }], [
      { id: 'tag-local', categoryId: 'cat-local', name: 'Красный' }
    ]);

    await migrateChildCatalogsToShared();
    expect(isCatalogMigrationDone()).toBe(true);

    const cats = listCatalogCategories('id1');
    expect(cats).toHaveLength(1);
    expect(cats[0]?.id).toBe('cat-local');
    expect(cats[0]?.visibilityMode).toBe('all');

    const childDb = new Database(
      path.join(state.parentPath, 'Lib1', LIBRARY_META_DIR, INDEX_DB_FILENAME)
    );
    expect(childDb.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).toEqual({
      n: 0
    });
    childDb.close();

    await migrateChildCatalogsToShared();
    expect(listCatalogCategories('id1')).toHaveLength(1);
  });

  it('merges same category names across libraries and remaps card_tags', async () => {
    seedChild(
      'Alpha',
      'ida',
      [{ id: 'ca', name: 'Цвет' }],
      [{ id: 'ta', categoryId: 'ca', name: 'Синий' }]
    );
    seedChild(
      'Beta',
      'idb',
      [{ id: 'cb', name: 'цвет' }],
      [{ id: 'tb', categoryId: 'cb', name: 'Синий' }]
    );

    const betaDb = new Database(
      path.join(state.parentPath, 'Beta', LIBRARY_META_DIR, INDEX_DB_FILENAME)
    );
    betaDb.prepare('INSERT INTO cards (id) VALUES (?)').run('card1');
    betaDb.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)').run('card1', 'tb');
    betaDb.close();

    await migrateChildCatalogsToShared();

    const cats = listCatalogCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0]?.id).toBe('ca');

    const after = new Database(
      path.join(state.parentPath, 'Beta', LIBRARY_META_DIR, INDEX_DB_FILENAME)
    );
    const row = after.prepare('SELECT tag_id FROM card_tags WHERE card_id = ?').get('card1') as {
      tag_id: string;
    };
    expect(row.tag_id).toBe('ta');
    after.close();
  });
});
