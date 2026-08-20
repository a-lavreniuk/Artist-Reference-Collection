import { describe, expect, it } from 'vitest';

import { defaultDetailCardTemplate } from '../../shared/detailCardTemplate';
import { defaultGalleryFilterLayout } from '../../shared/galleryFilterCore';
import {
  getLibrarySettingJson,
  hasLibrarySetting,
  LIBRARY_SETTING_TEMPLATE,
  readLibraryDetailTemplate,
  readSystemFilterLayout
} from '../librarySettings';

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

describe.skipIf(!sqliteOk)('librarySettings — missing table', () => {
  it('returns defaults instead of throwing when library_settings is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(':memory:');
    try {
      expect(getLibrarySettingJson(db, LIBRARY_SETTING_TEMPLATE)).toBeNull();
      expect(hasLibrarySetting(db, LIBRARY_SETTING_TEMPLATE)).toBe(false);
      expect(readLibraryDetailTemplate(db)).toEqual(defaultDetailCardTemplate());
      expect(readSystemFilterLayout(db)).toEqual(defaultGalleryFilterLayout());
    } finally {
      db.close();
    }
  });
});
