import { app } from 'electron';
import fs from 'fs';
import { writeFile, mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { countCards, ensureLibraryReady } from './storage/libraryStorage';
import { LIBRARY_CONTAINER_FOLDER_NAME } from './libraryContainer';

const CONFIG_FILENAME = 'library-root.json';

export type LibraryRegistryEntry = {
  id: string;
  name: string;
  path: string;
};

export type LibraryRootConfig = {
  /** Активная библиотека (путь к дочерней папке). Синхронизируется с activeLibraryId. */
  path?: string;
  parentPath?: string;
  activeLibraryId?: string;
  libraries?: LibraryRegistryEntry[];
  lastKnownCardCount?: number;
  snapshotAt?: string;
  /** Legacy wrap: нужна модалка имени перед миграцией. */
  pendingWrapMigrationPath?: string;
};

function configPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

export function readLibraryRootConfigSync(): LibraryRootConfig {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return JSON.parse(raw) as LibraryRootConfig;
  } catch {
    return {};
  }
}

async function writeConfigAtomic(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, contents, 'utf8');
  try {
    await rename(tmp, filePath);
  } catch {
    // Windows: target may exist — overwrite via copy+unlink fallback
    await writeFile(filePath, contents, 'utf8');
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** Сериализация записи: параллельные read-modify-write не затирают друг друга. */
let configWriteChain: Promise<void> = Promise.resolve();

function withConfigWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = configWriteChain.then(fn, fn);
  configWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalizeConfigPaths(next: LibraryRootConfig): LibraryRootConfig {
  if (typeof next.path === 'string') {
    next.path = path.resolve(next.path.trim());
  }
  if (typeof next.parentPath === 'string') {
    next.parentPath = path.resolve(next.parentPath.trim());
  }
  if (Array.isArray(next.libraries)) {
    next.libraries = next.libraries.map((lib) => ({
      ...lib,
      id: lib.id || randomUUID(),
      path: path.resolve(lib.path.trim()),
      name: lib.name.trim()
    }));
  }
  return next;
}

export async function writeLibraryRootConfig(patch: Partial<LibraryRootConfig>): Promise<void> {
  await withConfigWriteLock(async () => {
    // Читаем внутри lock — иначе устаревший merge затрёт libraries после repair.
    const current = readLibraryRootConfigSync();
    const next: LibraryRootConfig = { ...current };
    for (const key of Object.keys(patch) as Array<keyof LibraryRootConfig>) {
      const value = patch[key];
      if (value !== undefined) {
        (next as Record<string, unknown>)[key as string] = value;
      }
    }
    normalizeConfigPaths(next);
    await writeConfigAtomic(configPath(), JSON.stringify(next, null, 2));
  });
}

/** Полная перезапись конфига (без merge), для миграций. */
export async function replaceLibraryRootConfig(next: LibraryRootConfig): Promise<void> {
  await withConfigWriteLock(async () => {
    const normalized = normalizeConfigPaths({ ...next });
    await writeConfigAtomic(configPath(), JSON.stringify(normalized, null, 2));
  });
}

export function getActiveLibraryEntry(cfg: LibraryRootConfig = readLibraryRootConfigSync()): LibraryRegistryEntry | null {
  const libs = cfg.libraries ?? [];
  if (libs.length === 0) return null;
  if (cfg.activeLibraryId) {
    const byId = libs.find((l) => l.id === cfg.activeLibraryId);
    if (byId) return byId;
  }
  if (cfg.path) {
    const resolved = path.resolve(cfg.path);
    const byPath = libs.find((l) => path.resolve(l.path) === resolved);
    if (byPath) return byPath;
  }
  return libs[0] ?? null;
}

export function buildConfigWithActive(
  parentPath: string,
  libraries: LibraryRegistryEntry[],
  activeId: string,
  extra?: Partial<LibraryRootConfig>
): LibraryRootConfig {
  /** Порядок массива — пользовательский порядок отображения; не сортировать по имени. */
  const ordered = [...libraries];
  const active = ordered.find((l) => l.id === activeId) ?? ordered[0];
  if (!active) {
    return { parentPath, libraries: [], ...extra };
  }
  return {
    parentPath: path.resolve(parentPath),
    libraries: ordered,
    activeLibraryId: active.id,
    path: path.resolve(active.path),
    ...extra
  };
}

export function newLibraryEntry(name: string, libPath: string): LibraryRegistryEntry {
  return {
    id: randomUUID(),
    name,
    path: path.resolve(libPath)
  };
}

export function isMultiLibraryConfig(cfg: LibraryRootConfig): boolean {
  return Boolean(cfg.parentPath && Array.isArray(cfg.libraries) && cfg.libraries.length > 0);
}

export function looksLikeContainerPath(abs: string): boolean {
  return path.basename(path.resolve(abs)) === LIBRARY_CONTAINER_FOLDER_NAME;
}

export async function updateLibrarySessionSnapshot(libraryRoot: string, cardCount: number): Promise<void> {
  const root = path.resolve(libraryRoot);
  // Только скаляры; path — только если совпадает с активной (не сдвигать на новую пустую после create).
  await withConfigWriteLock(async () => {
    const current = readLibraryRootConfigSync();
    const active = getActiveLibraryEntry(current);
    const next: LibraryRootConfig = {
      ...current,
      lastKnownCardCount: cardCount,
      snapshotAt: new Date().toISOString()
    };
    if (!active || path.resolve(active.path) === root) {
      next.path = root;
    }
    normalizeConfigPaths(next);
    await writeConfigAtomic(configPath(), JSON.stringify(next, null, 2));
  });
}

export async function refreshLibrarySessionSnapshotFromDisk(): Promise<void> {
  const cfg = readLibraryRootConfigSync();
  const active = getActiveLibraryEntry(cfg);
  const root = active?.path
    ? path.resolve(active.path)
    : cfg.path?.trim()
      ? path.resolve(cfg.path.trim())
      : null;
  if (!root || !fs.existsSync(root)) return;
  try {
    await ensureLibraryReady(root);
    const count = countCards(root, 'all', 'all');
    await updateLibrarySessionSnapshot(root, count);
  } catch {
    /* best-effort */
  }
}
