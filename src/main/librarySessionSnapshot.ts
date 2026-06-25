import { app } from 'electron';
import fs from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { readHistory, type HistoryEntry } from './libraryHistory';
import { countCards, ensureLibraryReady } from './storage/libraryStorage';

const CONFIG_FILENAME = 'library-root.json';

export type LibraryRootConfig = {
  path?: string;
  lastKnownCardCount?: number;
  snapshotAt?: string;
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
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8');
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

  const configuredPath = cfg.path?.trim() ? path.resolve(cfg.path.trim()) : null;
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
    /* path may be wrong — conservative: show modal */
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
    path: root,
    lastKnownCardCount: cardCount,
    snapshotAt: new Date().toISOString()
  });
  if (cfg.path && path.resolve(cfg.path) !== root) {
    /* path updated */
  }
}

export async function refreshLibrarySessionSnapshotFromDisk(): Promise<void> {
  const cfg = readLibraryRootConfigSync();
  const root = cfg.path?.trim() ? path.resolve(cfg.path.trim()) : null;
  if (!root || !fs.existsSync(root)) return;
  try {
    await ensureLibraryReady(root);
    const count = countCards(root, 'all', 'all');
    await updateLibrarySessionSnapshot(root, count);
  } catch {
    /* best-effort */
  }
}
