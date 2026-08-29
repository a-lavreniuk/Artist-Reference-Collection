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

import { closeLibraryDb, openLibraryDb } from '../db';
import { listCardIdsAroundFromDb, listCardIdsFromDb } from '../libraryStorage';

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
const tmpRoot = path.join(os.tmpdir(), `arc-list-card-ids-${process.pid}`);

describe.skipIf(!sqliteOk)('listCardIdsFromDb', () => {
  afterEach(() => {
    closeLibraryDb();
  });

  it('returns only ids in sort order and a window around the center', async () => {
    await mkdir(tmpRoot, { recursive: true });
    try {
      const db = openLibraryDb(tmpRoot);
      const insert = db.prepare(
        `INSERT INTO cards (id, type, added_at, original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, is_deleted)
         VALUES (?, 'image', ?, ?, ?, ?, ?, 0)`
      );
      const ids = ['a', 'b', 'c', 'd', 'e'];
      ids.forEach((id, index) => {
        insert.run(
          id,
          `2026-01-0${index + 1}T00:00:00.000Z`,
          `cards/${id}/original.jpg`,
          `cards/${id}/thumb_s.webp`,
          `cards/${id}/thumb_m.webp`,
          `cards/${id}/thumb_l.webp`
        );
      });

      const sort = { field: 'addedAt' as const, direction: 'asc' as const };
      expect(
        listCardIdsFromDb(tmpRoot, { offset: 0, limit: 10, libraryScope: 'all', sort })
      ).toEqual(ids);
      expect(
        listCardIdsFromDb(tmpRoot, { offset: 1, limit: 2, libraryScope: 'all', sort })
      ).toEqual(['b', 'c']);
      expect(listCardIdsAroundFromDb(tmpRoot, { offset: 0, limit: 10, libraryScope: 'all', sort }, 'c', 1)).toEqual([
        'b',
        'c',
        'd'
      ]);
      expect(listCardIdsAroundFromDb(tmpRoot, { offset: 0, limit: 10, libraryScope: 'all', sort }, 'a', 2)).toEqual([
        'a',
        'b',
        'c'
      ]);
      expect(listCardIdsAroundFromDb(tmpRoot, { offset: 0, limit: 10, libraryScope: 'all', sort }, 'missing', 1)).toEqual(
        []
      );
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
