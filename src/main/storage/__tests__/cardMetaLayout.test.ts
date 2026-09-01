import { mkdir, readdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
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
import { CARD_META_DIR, thumbLRelPath, thumbMRelPath, thumbSRelPath } from '../cardFolder';
import { CARD_META_LAYOUT_VERSION, ensureCardMetaLayout } from '../cardMetaLayout';
import { readSystem } from '../systemFiles';

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
const tmpRoot = path.join(os.tmpdir(), `arc-card-meta-layout-${process.pid}`);

describe.skipIf(!sqliteOk)('ensureCardMetaLayout', () => {
  afterEach(() => {
    closeLibraryDb();
  });

  it('переносит служебные файлы в Meta/ и обновляет пути в индексе', async () => {
    await mkdir(tmpRoot, { recursive: true });
    try {
      const cardId = 'card-old';
      const cardDir = path.join(tmpRoot, 'cards', cardId);
      await mkdir(cardDir, { recursive: true });
      await writeFile(path.join(cardDir, 'original.jpg'), Buffer.from('img'));
      await writeFile(path.join(cardDir, 'card.json'), '{"version":1}');
      await writeFile(path.join(cardDir, 'thumb_s.webp'), Buffer.from('s'));
      await writeFile(path.join(cardDir, 'thumb_m.webp'), Buffer.from('m'));
      await writeFile(path.join(cardDir, 'thumb_l.webp'), Buffer.from('l'));
      await mkdir(path.join(cardDir, 'frames'), { recursive: true });
      await writeFile(path.join(cardDir, 'frames', 'frame-0.png'), Buffer.from('f'));
      await writeFile(path.join(cardDir, '_frame.jpg'), Buffer.from('tmp'));

      const db = openLibraryDb(tmpRoot);
      db.prepare(
        `INSERT INTO cards (id, type, added_at, original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, is_deleted)
         VALUES (?, 'image', ?, ?, ?, ?, ?, 0)`
      ).run(
        cardId,
        new Date().toISOString(),
        `cards/${cardId}/original.jpg`,
        `cards/${cardId}/thumb_s.webp`,
        `cards/${cardId}/thumb_m.webp`,
        `cards/${cardId}/thumb_l.webp`
      );

      await ensureCardMetaLayout(tmpRoot);

      const metaDir = path.join(cardDir, CARD_META_DIR);
      expect(existsSync(path.join(cardDir, 'original.jpg'))).toBe(true);
      expect(existsSync(path.join(cardDir, 'card.json'))).toBe(false);
      expect(existsSync(path.join(cardDir, 'thumb_s.webp'))).toBe(false);
      expect(existsSync(path.join(metaDir, 'card.json'))).toBe(true);
      expect(existsSync(path.join(metaDir, 'thumb_s.webp'))).toBe(true);
      expect(existsSync(path.join(metaDir, 'thumb_m.webp'))).toBe(true);
      expect(existsSync(path.join(metaDir, 'thumb_l.webp'))).toBe(true);
      expect(existsSync(path.join(metaDir, 'frames', 'frame-0.png'))).toBe(true);
      expect(existsSync(path.join(metaDir, '_frame.jpg'))).toBe(true);

      const rootNames = (await readdir(cardDir)).sort();
      expect(rootNames).toEqual([CARD_META_DIR, 'original.jpg'].sort());

      const row = db
        .prepare(`SELECT thumb_s_rel, thumb_m_rel, thumb_l_rel FROM cards WHERE id = ?`)
        .get(cardId) as { thumb_s_rel: string; thumb_m_rel: string; thumb_l_rel: string };
      expect(row.thumb_s_rel).toBe(thumbSRelPath(cardId));
      expect(row.thumb_m_rel).toBe(thumbMRelPath(cardId));
      expect(row.thumb_l_rel).toBe(thumbLRelPath(cardId));

      const sys = await readSystem(tmpRoot);
      expect(sys.cardMetaLayoutVersion).toBe(CARD_META_LAYOUT_VERSION);

      await ensureCardMetaLayout(tmpRoot);
      expect(existsSync(path.join(metaDir, 'thumb_s.webp'))).toBe(true);
      expect(existsSync(path.join(cardDir, 'original.jpg'))).toBe(true);
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
