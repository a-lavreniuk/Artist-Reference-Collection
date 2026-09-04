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
    },
    getVersion: () => '0.0.0-test'
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
  flattenNestedLibrariesInContainer,
  listLibrariesFromConfig,
  openLibraryOrContainer,
  renameLibrary,
  reorderLibraries,
  repairLibraryRegistryIfNeeded,
  switchActiveLibrary
} from '../multiLibrary';
import { LIBRARY_CONTAINER_FOLDER_NAME } from '../libraryContainer';
import { LIBRARY_FOLDER_EXISTS_ERROR } from '../shared/libraryNameCopy';
import {
  replaceLibraryRootConfig,
  readLibraryRootConfigSync,
  updateLibrarySessionSnapshot,
  writeLibraryRootConfig
} from '../librarySessionSnapshot';

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

    // Новая библиотека не должна становиться активной сама — иначе галерея «пустая».
    const afterCreate = readLibraryRootConfigSync();
    expect(afterCreate.activeLibraryId).toBe(a.library.id);
    expect(afterCreate.libraries).toHaveLength(2);

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

  it('updateLibrarySessionSnapshot does not wipe libraries registry', async () => {
    const parent = path.join(tmpRoot, 'Snap', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'A');
    const libB = path.join(parent, 'B');
    fs.mkdirSync(libA, { recursive: true });
    fs.mkdirSync(libB, { recursive: true });
    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [
        { id: 'a', name: 'A', path: libA },
        { id: 'b', name: 'B', path: libB }
      ],
      activeLibraryId: 'a',
      path: libA,
      lastKnownCardCount: 10
    });

    await updateLibrarySessionSnapshot(libA, 42);
    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(2);
    expect(cfg.activeLibraryId).toBe('a');
    expect(cfg.lastKnownCardCount).toBe(42);
    expect(cfg.parentPath).toBe(path.resolve(parent));
  });

  it('writeLibraryRootConfig ignores undefined keys (does not clear libraries)', async () => {
    const parent = path.join(tmpRoot, 'Und', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'A');
    fs.mkdirSync(libA, { recursive: true });
    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [{ id: 'a', name: 'A', path: libA }],
      activeLibraryId: 'a',
      path: libA
    });

    await writeLibraryRootConfig({
      path: libA,
      libraries: undefined,
      parentPath: undefined,
      activeLibraryId: undefined
    });
    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(1);
    expect(cfg.parentPath).toBe(path.resolve(parent));
    expect(cfg.activeLibraryId).toBe('a');
  });

  it('repair keeps registered folder even without arc-index.db', async () => {
    const parent = path.join(tmpRoot, 'Keep', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'Основная');
    const libB = path.join(parent, 'Новая');
    fs.mkdirSync(path.join(libA, 'meta'), { recursive: true });
    fs.writeFileSync(path.join(libA, 'meta', 'arc-index.db'), '');
    fs.mkdirSync(libB, { recursive: true }); // ещё без index

    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [
        { id: 'a', name: 'Основная', path: libA },
        { id: 'b', name: 'Новая', path: libB }
      ],
      activeLibraryId: 'a',
      path: libA
    });

    const repaired = await repairLibraryRegistryIfNeeded();
    expect(repaired).toBe(false); // уже полный набор
    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(2);
    expect(cfg.libraries?.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('repair does not re-add unlinked library still on disk', async () => {
    const parent = path.join(tmpRoot, 'Unlink', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'Основная');
    const libB = path.join(parent, 'Запасная');
    for (const lib of [libA, libB]) {
      fs.mkdirSync(path.join(lib, 'meta'), { recursive: true });
      fs.writeFileSync(path.join(lib, 'meta', 'arc-index.db'), '');
    }

    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [{ id: 'a', name: 'Основная', path: libA }],
      activeLibraryId: 'a',
      path: libA
    });

    const repaired = await repairLibraryRegistryIfNeeded();
    expect(repaired).toBe(false);
    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(1);
    expect(cfg.libraries?.[0]?.id).toBe('a');
  });

  it('repairLibraryRegistryIfNeeded restores missing libraries from disk', async () => {
    const parent = path.join(tmpRoot, 'Repair', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'Основная');
    const libB = path.join(parent, 'Запасная');
    fs.mkdirSync(libA, { recursive: true });
    fs.mkdirSync(libB, { recursive: true });
    for (const lib of [libA, libB]) {
      fs.mkdirSync(path.join(lib, 'meta'), { recursive: true });
      fs.writeFileSync(path.join(lib, 'meta', 'arc-index.db'), '');
    }

    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [],
      activeLibraryId: undefined,
      path: libA,
      lastKnownCardCount: 5
    });

    const repaired = await repairLibraryRegistryIfNeeded();
    expect(repaired).toBe(true);
    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries?.length).toBeGreaterThanOrEqual(2);
    expect(cfg.parentPath).toBe(path.resolve(parent));
  });

  it('concurrent snapshot and replace do not wipe libraries', async () => {
    const parent = path.join(tmpRoot, 'Race', LIBRARY_CONTAINER_FOLDER_NAME);
    const libA = path.join(parent, 'A');
    const libB = path.join(parent, 'B');
    fs.mkdirSync(libA, { recursive: true });
    fs.mkdirSync(libB, { recursive: true });
    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [
        { id: 'a', name: 'A', path: libA },
        { id: 'b', name: 'B', path: libB }
      ],
      activeLibraryId: 'a',
      path: libA,
      lastKnownCardCount: 1
    });

    await Promise.all([
      updateLibrarySessionSnapshot(libA, 10),
      updateLibrarySessionSnapshot(libA, 20),
      writeLibraryRootConfig({ lastKnownCardCount: 30 }),
      updateLibrarySessionSnapshot(libA, 40)
    ]);

    const cfg = readLibraryRootConfigSync();
    expect(cfg.libraries).toHaveLength(2);
    expect(cfg.activeLibraryId).toBe('a');
    expect(cfg.parentPath).toBe(path.resolve(parent));
  });

  function seedMinimalLibrary(libPath: string): void {
    fs.mkdirSync(path.join(libPath, 'meta'), { recursive: true });
    fs.mkdirSync(path.join(libPath, 'cards'), { recursive: true });
    fs.writeFileSync(path.join(libPath, 'meta', 'arc-index.db'), '');
  }

  it('flattenNestedLibrariesInContainer lifts nested libs and removes empty shell', async () => {
    const container = path.join(tmpRoot, 'Flat', LIBRARY_CONTAINER_FOLDER_NAME);
    const shell = path.join(container, 'Основная');
    const nestedMain = path.join(shell, 'Основная');
    const nestedSpare = path.join(shell, 'Запасная');
    seedMinimalLibrary(shell);
    seedMinimalLibrary(nestedMain);
    seedMinimalLibrary(nestedSpare);

    const { changed, pathMap } = await flattenNestedLibrariesInContainer(container);
    expect(changed).toBe(true);
    // Имя «Основная» остаётся — это бывшая вложенная библиотека на месте оболочки.
    expect(fs.existsSync(path.join(container, 'Основная'))).toBe(true);
    expect(fs.existsSync(path.join(container, 'Запасная'))).toBe(true);
    expect(fs.existsSync(path.join(container, 'Основная', 'Основная'))).toBe(false);
    expect(fs.existsSync(path.join(container, 'Основная', 'Запасная'))).toBe(false);
    expect(pathMap.get(path.resolve(nestedMain))).toBe(path.resolve(path.join(container, 'Основная')));
    expect(pathMap.get(path.resolve(nestedSpare))).toBe(path.resolve(path.join(container, 'Запасная')));
  });

  it('openLibraryOrContainer flattens and activates nested library with data path', async () => {
    const container = path.join(tmpRoot, 'OpenFlat', LIBRARY_CONTAINER_FOLDER_NAME);
    const shell = path.join(container, 'Основная');
    const nestedMain = path.join(shell, 'Основная');
    seedMinimalLibrary(shell);
    seedMinimalLibrary(nestedMain);

    const opened = await openLibraryOrContainer(container);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(fs.existsSync(path.join(container, 'Основная', 'Основная'))).toBe(false);
    expect(path.resolve(opened.path)).toBe(path.resolve(path.join(container, 'Основная')));
    const cfg = readLibraryRootConfigSync();
    expect(cfg.parentPath).toBe(path.resolve(container));
    expect(cfg.libraries?.every((l) => path.dirname(l.path) === path.resolve(container))).toBe(true);
  });

  it('openLibraryOrContainer accepts deeply nested library under container', async () => {
    const container = path.join(tmpRoot, 'DeepOpen', LIBRARY_CONTAINER_FOLDER_NAME);
    const shell = path.join(container, 'Оболочка');
    const nested = path.join(shell, 'Реальная');
    seedMinimalLibrary(shell);
    seedMinimalLibrary(nested);

    const opened = await openLibraryOrContainer(nested);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(path.resolve(opened.path)).toBe(path.resolve(path.join(container, 'Реальная')));
    expect(fs.existsSync(path.join(container, 'Реальная'))).toBe(true);
  });

  it('creates libraries in append order and listLibraries preserves it', async () => {
    const parentHint = path.join(tmpRoot, 'OrderCreate');
    fs.mkdirSync(parentHint, { recursive: true });

    const first = await createLibraryInContainer('Яблоко', parentHint);
    const second = await createLibraryInContainer('Абрикос', parentHint);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const listed = listLibrariesFromConfig();
    expect(listed.map((l) => l.id)).toEqual([first.library.id, second.library.id]);
  });

  it('refuses create when a non-ARC folder already occupies the name', async () => {
    const parentHint = path.join(tmpRoot, 'ForeignFolder');
    fs.mkdirSync(parentHint, { recursive: true });

    const first = await createLibraryInContainer('Альфа', parentHint);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const container = path.join(parentHint, LIBRARY_CONTAINER_FOLDER_NAME);
    fs.mkdirSync(path.join(container, 'Чужая'));

    const res = await createLibraryInContainer('Чужая', parentHint);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldError).toBe(true);
    expect(res.error).toBe(LIBRARY_FOLDER_EXISTS_ERROR);
    expect(listLibrariesFromConfig()).toHaveLength(1);
  });

  it('reorderLibraries changes display order without switching active', async () => {
    const parentHint = path.join(tmpRoot, 'OrderReorder');
    fs.mkdirSync(parentHint, { recursive: true });

    const a = await createLibraryInContainer('Альфа', parentHint);
    const b = await createLibraryInContainer('Бета', parentHint);
    const c = await createLibraryInContainer('Гамма', parentHint);
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;

    const before = readLibraryRootConfigSync();
    expect(before.activeLibraryId).toBe(a.library.id);

    const reordered = await reorderLibraries([c.library.id, a.library.id, b.library.id]);
    expect(reordered.ok).toBe(true);

    const listed = listLibrariesFromConfig();
    expect(listed.map((l) => l.id)).toEqual([c.library.id, a.library.id, b.library.id]);
    expect(listed.find((l) => l.active)?.id).toBe(a.library.id);
    expect(readLibraryRootConfigSync().activeLibraryId).toBe(a.library.id);
  });

  it('repair preserves custom library order when paths unchanged', async () => {
    const parent = path.join(tmpRoot, 'OrderRepair', LIBRARY_CONTAINER_FOLDER_NAME);
    const libZ = path.join(parent, 'Зебра');
    const libA = path.join(parent, 'Аист');
    for (const lib of [libZ, libA]) {
      fs.mkdirSync(path.join(lib, 'meta'), { recursive: true });
      fs.writeFileSync(path.join(lib, 'meta', 'arc-index.db'), '');
    }

    await replaceLibraryRootConfig({
      parentPath: parent,
      libraries: [
        { id: 'z', name: 'Зебра', path: libZ },
        { id: 'a', name: 'Аист', path: libA }
      ],
      activeLibraryId: 'z',
      path: libZ
    });

    const repaired = await repairLibraryRegistryIfNeeded();
    expect(repaired).toBe(false);
    expect(listLibrariesFromConfig().map((l) => l.id)).toEqual(['z', 'a']);
  });
});
