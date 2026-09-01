import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = path.join(os.tmpdir(), `arc-merge-tags-test-${process.pid}`);

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
  getActiveLibraryEntry: () => state.libraries.find((l) => l.id === state.activeLibraryId) ?? null,
  replaceLibraryRootConfig: vi.fn()
}));

import Database from 'better-sqlite3';
import {
  closeTagCatalogDb,
  listAllCatalogTags,
  openTagCatalogDb,
  upsertCatalogCategory,
  upsertCatalogTag
} from '../tagCatalog';
import { mergeTagsInStorage, replaceTagIds, undoMergeTagsInStorage } from '../libraryStorage';
import { INDEX_DB_FILENAME, LIBRARY_META_DIR } from '../../libraryFilenames';

const LIB_PATH = () => path.join(state.parentPath, 'Lib1');

function childDb(): Database.Database {
  return new Database(path.join(LIB_PATH(), LIBRARY_META_DIR, INDEX_DB_FILENAME));
}

function seedLibrary(cardTags: Record<string, string[]>): void {
  const meta = path.join(LIB_PATH(), LIBRARY_META_DIR);
  fs.mkdirSync(meta, { recursive: true });
  const db = new Database(path.join(meta, INDEX_DB_FILENAME));
  db.exec(`
    CREATE TABLE cards (id TEXT PRIMARY KEY, is_deleted INTEGER DEFAULT 0);
    CREATE TABLE card_tags (card_id TEXT, tag_id TEXT, PRIMARY KEY (card_id, tag_id));
  `);
  for (const [cardId, tagIds] of Object.entries(cardTags)) {
    db.prepare('INSERT INTO cards (id) VALUES (?)').run(cardId);
    for (const tagId of tagIds) {
      db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)').run(cardId, tagId);
    }
    const dir = path.join(LIB_PATH(), 'cards', cardId, 'Meta');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'card.json'),
      JSON.stringify({ version: 1, id: cardId, type: 'image', tagIds, collectionIds: [] })
    );
  }
  db.close();
  state.libraries = [{ id: 'lib-1', name: 'Lib1', path: LIB_PATH() }];
  state.activeLibraryId = 'lib-1';
}

function readCardTagIds(cardId: string): string[] {
  const raw = fs.readFileSync(path.join(LIB_PATH(), 'cards', cardId, 'Meta', 'card.json'), 'utf8');
  return (JSON.parse(raw) as { tagIds: string[] }).tagIds;
}

function readCardTagRows(db: Database.Database, cardId: string): string[] {
  return (
    db.prepare('SELECT tag_id FROM card_tags WHERE card_id = ? ORDER BY tag_id').all(cardId) as Array<{
      tag_id: string;
    }>
  ).map((r) => r.tag_id);
}

describe('replaceTagIds', () => {
  it('replaces sources with the target and keeps order', () => {
    expect(replaceTagIds(['a', 'src', 'b'], new Set(['src']), 'target')).toEqual([
      'a',
      'target',
      'b'
    ]);
  });

  it('collapses duplicates when the target is already on the card', () => {
    expect(replaceTagIds(['target', 'src-1', 'src-2'], new Set(['src-1', 'src-2']), 'target')).toEqual([
      'target'
    ]);
    expect(replaceTagIds(['src-1', 'target'], new Set(['src-1']), 'target')).toEqual(['target']);
  });

  it('leaves unrelated tags untouched', () => {
    expect(replaceTagIds(['a', 'b'], new Set(['src']), 'target')).toEqual(['a', 'b']);
  });
});

describe.skipIf(!sqliteOk)('mergeTagsInStorage', () => {
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpRoot, 'userData'), { recursive: true });
    state.parentPath = path.join(tmpRoot, 'container');
    fs.mkdirSync(path.join(state.parentPath, LIBRARY_META_DIR), { recursive: true });
    closeTagCatalogDb();
    openTagCatalogDb(state.parentPath);

    upsertCatalogCategory({
      id: 'cat-1',
      name: 'Цвет',
      colorHex: '#EAB308',
      weight: 'neutral',
      sortIndex: 0,
      createdAt: new Date().toISOString(),
      visibilityMode: 'all',
      visibilityLibraryIds: []
    });
    upsertCatalogTag({ id: 'target', categoryId: 'cat-1', name: 'Синий', usageCount: 0 });
    upsertCatalogTag({
      id: 'src-1',
      categoryId: 'cat-1',
      name: 'синий',
      usageCount: 0,
      description: 'Оттенки синего'
    });
    upsertCatalogTag({ id: 'src-2', categoryId: 'cat-1', name: 'Blue', usageCount: 0 });
  });

  afterEach(() => {
    closeTagCatalogDb();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('remaps card links, removes source tags and keeps the target category', async () => {
    seedLibrary({
      'card-a': ['src-1'],
      'card-b': ['target', 'src-2'],
      'card-c': ['other']
    });

    await mergeTagsInStorage({
      targetTagId: 'target',
      sourceTagIds: ['src-1', 'src-2'],
      targetMetadata: { name: 'Синий', description: 'Оттенки синего' }
    });

    expect(readCardTagIds('card-a')).toEqual(['target']);
    expect(readCardTagIds('card-b')).toEqual(['target']);
    expect(readCardTagIds('card-c')).toEqual(['other']);

    const db = childDb();
    expect(readCardTagRows(db, 'card-a')).toEqual(['target']);
    expect(readCardTagRows(db, 'card-b')).toEqual(['target']);
    db.close();

    const catalog = listAllCatalogTags();
    expect(catalog.map((t) => t.id).sort()).toEqual(['target']);
    const target = catalog[0];
    expect(target?.categoryId).toBe('cat-1');
    expect(target?.description).toBe('Оттенки синего');
    expect(target?.usageCount).toBe(2);
  });

  it('applies the chosen name and image to the target', async () => {
    seedLibrary({ 'card-a': ['src-1'] });

    await mergeTagsInStorage({
      targetTagId: 'target',
      sourceTagIds: ['src-1'],
      targetMetadata: { name: 'Blue', tooltipImage: 'data:image/png;base64,AAA' }
    });

    const target = listAllCatalogTags().find((t) => t.id === 'target');
    expect(target?.name).toBe('Blue');
    expect(target?.tooltipImage).toBe('data:image/png;base64,AAA');
  });

  it('ignores the target when it is also listed as a source', async () => {
    seedLibrary({ 'card-a': ['target', 'src-1'] });

    const undo = await mergeTagsInStorage({
      targetTagId: 'target',
      sourceTagIds: ['target', 'src-1'],
      targetMetadata: { name: 'Синий' }
    });

    expect(undo.removedTags.map((t) => t.id)).toEqual(['src-1']);
    expect(readCardTagIds('card-a')).toEqual(['target']);
  });

  it('rejects a merge with no real source tags', async () => {
    seedLibrary({ 'card-a': ['target'] });

    await expect(
      mergeTagsInStorage({
        targetTagId: 'target',
        sourceTagIds: ['target'],
        targetMetadata: { name: 'Синий' }
      })
    ).rejects.toThrow('Нет меток для слияния');
  });

  it('restores catalog and card links on undo', async () => {
    seedLibrary({
      'card-a': ['src-1'],
      'card-b': ['target', 'src-2']
    });

    const undo = await mergeTagsInStorage({
      targetTagId: 'target',
      sourceTagIds: ['src-1', 'src-2'],
      targetMetadata: { name: 'Объединённая', description: 'Новое описание' }
    });

    await undoMergeTagsInStorage(undo);

    expect(readCardTagIds('card-a')).toEqual(['src-1']);
    expect(readCardTagIds('card-b')).toEqual(['target', 'src-2']);

    const catalog = listAllCatalogTags();
    expect(catalog.map((t) => t.id).sort()).toEqual(['src-1', 'src-2', 'target']);
    expect(catalog.find((t) => t.id === 'target')?.name).toBe('Синий');
    expect(catalog.find((t) => t.id === 'src-1')?.description).toBe('Оттенки синего');
  });
});
