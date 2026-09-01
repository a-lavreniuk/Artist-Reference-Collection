import { mkdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
    getVersion: () => '0.0.0-test'
  }
}));

vi.mock('../../libraryRootConfig', () => {
  const nodePath = require('path') as typeof import('path');
  const nodeOs = require('os') as typeof import('os');
  return {
    readParentLibraryPathSync: () => nodePath.join(nodeOs.tmpdir(), `arc-collection-hierarchy-${process.pid}`)
  };
});

import { closeLibraryDb, openLibraryDb } from '../db';
import {
  getCollectionCardCounts,
  listCollections,
  upsertCollection
} from '../libraryStorage';

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
const tmpRoot = path.join(os.tmpdir(), `arc-collection-hierarchy-${process.pid}`);

describe.skipIf(!sqliteOk)('collection parent_id schema', () => {
  afterEach(() => {
    closeLibraryDb();
  });

  it('adds parent_id and enforces one-level sections', async () => {
    await mkdir(tmpRoot, { recursive: true });
    try {
      const db = openLibraryDb(tmpRoot);
      const cols = db.prepare(`PRAGMA table_info(collections)`).all() as Array<{ name: string }>;
      expect(cols.some((c) => c.name === 'parent_id')).toBe(true);

      upsertCollection(tmpRoot, {
        id: 'c1',
        name: 'Персонажи',
        createdAt: new Date().toISOString(),
        sortIndex: 0
      });
      upsertCollection(tmpRoot, {
        id: 's1',
        name: 'Портреты',
        createdAt: new Date().toISOString(),
        sortIndex: 0,
        parentId: 'c1'
      });
      expect(() =>
        upsertCollection(tmpRoot, {
          id: 's-bad',
          name: 'Вложенный',
          createdAt: new Date().toISOString(),
          sortIndex: 0,
          parentId: 's1'
        })
      ).toThrow(/Раздел нельзя вложить/);
      expect(() =>
        upsertCollection(tmpRoot, {
          id: 's2',
          name: 'Портреты',
          createdAt: new Date().toISOString(),
          sortIndex: 1,
          parentId: 'c1'
        })
      ).toThrow(/Раздел с таким названием уже есть/);

      db.prepare(
        `INSERT INTO cards (id, type, added_at, original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, is_deleted)
         VALUES ('card-1', 'image', ?, 'cards/card-1/original.jpg', 'cards/card-1/Meta/thumb_s.webp', 'cards/card-1/Meta/thumb_m.webp', 'cards/card-1/Meta/thumb_l.webp', 0)`
      ).run(new Date().toISOString());
      db.prepare(`INSERT INTO card_collections (card_id, collection_id) VALUES ('card-1', 's1')`).run();

      const counts = getCollectionCardCounts(tmpRoot);
      expect(counts.c1).toBe(1);
      expect(counts.s1).toBe(1);
      expect(listCollections(tmpRoot).map((c) => c.id).sort()).toEqual(['c1', 's1']);
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
