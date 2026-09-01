import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = path.join(os.tmpdir(), `arc-delete-tags-test-${process.pid}`);

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
import { deleteTagsInStorage, removeTagIds, undoDeleteTagsInStorage } from '../libraryStorage';
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

describe('removeTagIds', () => {
  it('убирает удаляемые метки и сохраняет порядок остальных', () => {
    expect(removeTagIds(['a', 'gone', 'b'], new Set(['gone']))).toEqual(['a', 'b']);
  });

  it('возвращает пустой список, когда удаляют всё', () => {
    expect(removeTagIds(['a', 'b'], new Set(['a', 'b']))).toEqual([]);
  });

  it('схлопывает дубликаты, оставшиеся на карточке', () => {
    expect(removeTagIds(['a', 'a', 'b'], new Set(['gone']))).toEqual(['a', 'b']);
  });

  it('не трогает карточку без удаляемых меток', () => {
    expect(removeTagIds(['a', 'b'], new Set(['gone']))).toEqual(['a', 'b']);
  });
});

describe.skipIf(!sqliteOk)('deleteTagsInStorage', () => {
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
    upsertCatalogTag({ id: 'tag-a', categoryId: 'cat-1', name: 'Синий', usageCount: 0 });
    upsertCatalogTag({
      id: 'tag-b',
      categoryId: 'cat-1',
      name: 'Красный',
      usageCount: 0,
      description: 'Оттенки красного'
    });
    upsertCatalogTag({ id: 'keep', categoryId: 'cat-1', name: 'Зелёный', usageCount: 0 });
  });

  afterEach(() => {
    closeTagCatalogDb();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('снимает метки с карточек и убирает их из каталога', async () => {
    seedLibrary({
      'card-a': ['tag-a', 'keep'],
      'card-b': ['tag-a', 'tag-b'],
      'card-c': ['keep']
    });

    await deleteTagsInStorage(['tag-a', 'tag-b']);

    expect(readCardTagIds('card-a')).toEqual(['keep']);
    expect(readCardTagIds('card-b')).toEqual([]);
    expect(readCardTagIds('card-c')).toEqual(['keep']);

    const db = childDb();
    expect(readCardTagRows(db, 'card-a')).toEqual(['keep']);
    expect(readCardTagRows(db, 'card-b')).toEqual([]);
    db.close();

    const catalog = listAllCatalogTags();
    expect(catalog.map((t) => t.id).sort()).toEqual(['keep']);
    expect(catalog.find((t) => t.id === 'keep')?.usageCount).toBe(2);
  });

  it('игнорирует неизвестные метки, но удаляет найденные', async () => {
    seedLibrary({ 'card-a': ['tag-a'] });

    const undo = await deleteTagsInStorage(['tag-a', 'missing']);

    expect(undo.removedTags.map((t) => t.id)).toEqual(['tag-a']);
    expect(listAllCatalogTags().map((t) => t.id).sort()).toEqual(['keep', 'tag-b']);
  });

  it('отказывается удалять, когда ни одной метки нет в каталоге', async () => {
    seedLibrary({ 'card-a': ['tag-a'] });

    await expect(deleteTagsInStorage(['missing'])).rejects.toThrow('Нет меток для удаления');
    expect(readCardTagIds('card-a')).toEqual(['tag-a']);
  });

  it('возвращает метки и связи карточек при отмене', async () => {
    seedLibrary({
      'card-a': ['tag-a', 'keep'],
      'card-b': ['tag-b']
    });

    const undo = await deleteTagsInStorage(['tag-a', 'tag-b']);
    await undoDeleteTagsInStorage(undo);

    expect(readCardTagIds('card-a')).toEqual(['tag-a', 'keep']);
    expect(readCardTagIds('card-b')).toEqual(['tag-b']);

    const catalog = listAllCatalogTags();
    expect(catalog.map((t) => t.id).sort()).toEqual(['keep', 'tag-a', 'tag-b']);
    expect(catalog.find((t) => t.id === 'tag-b')?.description).toBe('Оттенки красного');
    expect(catalog.find((t) => t.id === 'tag-a')?.usageCount).toBe(1);
  });
});
