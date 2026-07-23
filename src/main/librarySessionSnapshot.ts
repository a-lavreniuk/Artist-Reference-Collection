import { app } from 'electron';
import fs from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { readHistory, type HistoryEntry } from './libraryHistory';
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

export async function writeLibraryRootConfig(patch: LibraryRootConfig): Promise<void> {
  const current = readLibraryRootConfigSync();
  const next: LibraryRootConfig = { ...current, ...patch };
  if (typeof next.path === 'string') {
    next.path = path.resolve(next.path.trim());
  }
  if (typeof next.parentPath === 'string') {
    next.parentPath = path.resolve(next.parentPath.trim());
  }
  if (Array.isArray(next.libraries)) {
    next.libraries = next.libraries.map((lib) => ({
      ...lib,
      path: path.resolve(lib.path.trim()),
      name: lib.name.trim()
    }));
  }
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8');
}

/** Полная перезапись конфига (без merge), для миграций. */
export async function replaceLibraryRootConfig(next: LibraryRootConfig): Promise<void> {
  const normalized: LibraryRootConfig = { ...next };
  if (typeof normalized.path === 'string') {
    normalized.path = path.resolve(normalized.path.trim());
  }
  if (typeof normalized.parentPath === 'string') {
    normalized.parentPath = path.resolve(normalized.parentPath.trim());
  }
  if (Array.isArray(normalized.libraries)) {
    normalized.libraries = normalized.libraries.map((lib) => ({
      ...lib,
      id: lib.id || randomUUID(),
      path: path.resolve(lib.path.trim()),
      name: lib.name.trim()
    }));
  }
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), JSON.stringify(normalized, null, 2), 'utf8');
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
  return [...libs].sort((a, b) => a.name.localeCompare(b.name, 'ru'))[0] ?? null;
}

export function buildConfigWithActive(
  parentPath: string,
  libraries: LibraryRegistryEntry[],
  activeId: string,
  extra?: Partial<LibraryRootConfig>
): LibraryRootConfig {
  const sorted = [...libraries].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const active = sorted.find((l) => l.id === activeId) ?? sorted[0];
  if (!active) {
    return { parentPath, libraries: [], ...extra };
  }
  return {
    parentPath: path.resolve(parentPath),
    libraries: sorted,
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

const DELETE_HISTORY_RE = /удал|корзин|навсегда|очист/i;

function entryAfterSnapshot(entry: HistoryEntry, snapshotAt: string | undefined): boolean {
  if (!snapshotAt) return true;
  const entryTime = Date.parse(entry.time.replace(' ', 'T'));
  const snapTime = Date.parse(snapshotAt);
  if (Number.isNaN(entryTime) || Number.isNaN(snapTime)) return true;
  return entryTime >= snapTime;
}

export function historyHasDeletionSinceSnapshot(
  entries: HistoryEntry[],
  snapshotAt: string | undefined
): boolean {
  for (const entry of entries) {
    if (!entryAfterSnapshot(entry, snapshotAt)) continue;
    if (DELETE_HISTORY_RE.test(entry.message)) return true;
  }
  return false;
}

export type RelocateModalCheck =
  | { show: false }
  | { show: true; reason: 'path_missing' | 'empty_library' };

export async function checkShouldOfferRelocateModal(): Promise<RelocateModalCheck> {
  const cfg = readLibraryRootConfigSync();
  const lastKnown = cfg.lastKnownCardCount ?? 0;
  if (lastKnown <= 0) return { show: false };

  const active = getActiveLibraryEntry(cfg);
  const configuredPath = active?.path
    ? path.resolve(active.path)
    : cfg.path?.trim()
      ? path.resolve(cfg.path.trim())
      : null;
  if (!configuredPath) {
    return { show: true, reason: 'path_missing' };
  }

  const pathExists = fs.existsSync(configuredPath);
  if (!pathExists) {
    return { show: true, reason: 'path_missing' };
  }

  let cardCount = 0;
  try {
    await ensureLibraryReady(configuredPath);
    cardCount = countCards(configuredPath, 'all', 'all');
  } catch {
    return { show: true, reason: 'path_missing' };
  }

  if (cardCount > 0) {
    await updateLibrarySessionSnapshot(configuredPath, cardCount);
    return { show: false };
  }

  let historyEntries: HistoryEntry[] = [];
  try {
    historyEntries = await readHistory(configuredPath);
  } catch {
    return { show: true, reason: 'empty_library' };
  }

  if (historyHasDeletionSinceSnapshot(historyEntries, cfg.snapshotAt)) {
    await updateLibrarySessionSnapshot(configuredPath, 0);
    return { show: false };
  }

  return { show: true, reason: 'empty_library' };
}

export async function updateLibrarySessionSnapshot(libraryRoot: string, cardCount: number): Promise<void> {
  const root = path.resolve(libraryRoot);
  const cfg = readLibraryRootConfigSync();
  await writeLibraryRootConfig({
    ...cfg,
    path: root,
    lastKnownCardCount: cardCount,
    snapshotAt: new Date().toISOString()
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
