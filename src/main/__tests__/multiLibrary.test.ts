import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = path.join(os.tmpdir(), `arc-multi-lib-test-${process.pid}`);

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(tmpRoot, 'userData');
      return path.join(tmpRoot, name);
    }
  }
}));

vi.mock('../libraryFolderIcon', () => ({
  applyLibraryFolderIcon: vi.fn()
}));

vi.mock('../appPreferences', async () => {
  const actual = await vi.importActual<typeof import('../appPreferences')>('../appPreferences');
  return {
    ...actual,
    removeAutoImportForLibraryId: vi.fn(async () => undefined),
    seedAutoImportFromLegacyIfNeeded: vi.fn(async () => undefined)
  };
});

import {
  createLibraryInContainer,
  deleteLibrary,
  listLibrariesFromConfig,
  renameLibrary,
  switchActiveLibrary
} from '../multiLibrary';
import { LIBRARY_CONTAINER_FOLDER_NAME } from '../libraryContainer';
import { replaceLibraryRootConfig, readLibraryRootConfigSync } from '../librarySessionSnapshot';

describe('multiLibrary manage', () => {
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpRoot, 'userData'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('creates two libraries, renames, switches, and deletes with neighbor active', async () => {
    const parentHint = path.join(tmpRoot, 'Documents');
    fs.mkdirSync(parentHint, { recursive: true });

    const a = await createLibraryInContainer('Альфа', parentHint);
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const b = await createLibraryInContainer('Бета', parentHint);
    expect(b.ok).toBe(true);
    if (!b.ok) return;

    const container = path.join(parentHint, LIBRARY_CONTAINER_FOLDER_NAME);
    expect(fs.existsSync(path.join(container, 'Альфа'))).toBe(true);
    expect(fs.existsSync(path.join(container, 'Бета'))).toBe(true);

    const renamed = await renameLibrary(a.library.id, 'Альфа-2');
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(fs.existsSync(path.join(container, 'Альфа-2'))).toBe(true);
    expect(fs.existsSync(path.join(container, 'Альфа'))).toBe(false);

    const switched = await switchActiveLibrary(renamed.library.id);
    expect(switched.ok).toBe(true);

    const listed = listLibrariesFromConfig();
    expect(listed).toHaveLength(2);
    expect(listed.find((l) => l.id === renamed.library.id)?.active).toBe(true);

    const deleted = await deleteLibrary(renamed.library.id, 'disk');
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.switchedToId).toBe(b.library.id);
    expect(fs.existsSync(path.join(container, 'Альфа-2'))).toBe(false);

    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(1);
    expect(cfg.activeLibraryId).toBe(b.library.id);
  });

  it('refuses to delete the last library', async () => {
    const parentHint = path.join(tmpRoot, 'Documents2');
    fs.mkdirSync(parentHint, { recursive: true });
    const created = await createLibraryInContainer('Единственная', parentHint);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await deleteLibrary(created.library.id, 'unlink');
    expect(res.ok).toBe(false);
  });

  it('writes library-root.json atomically (file exists after replace)', async () => {
    await replaceLibraryRootConfig({
      parentPath: path.join(tmpRoot, 'P', LIBRARY_CONTAINER_FOLDER_NAME),
      libraries: [{ id: '1', name: 'X', path: path.join(tmpRoot, 'P', LIBRARY_CONTAINER_FOLDER_NAME, 'X') }],
      activeLibraryId: '1',
      path: path.join(tmpRoot, 'P', LIBRARY_CONTAINER_FOLDER_NAME, 'X')
    });
    const cfgPath = path.join(tmpRoot, 'userData', 'library-root.json');
    expect(fs.existsSync(cfgPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { activeLibraryId?: string };
    expect(parsed.activeLibraryId).toBe('1');
  });
});
