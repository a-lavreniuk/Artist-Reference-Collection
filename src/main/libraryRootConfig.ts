import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  readLibraryRootConfigSync,
  writeLibraryRootConfig,
  getActiveLibraryEntry,
  isMultiLibraryConfig,
  type LibraryRootConfig
} from './librarySessionSnapshot';
import { writeAppPreferences } from './appPreferences';

let cachedLibraryRoot: string | null | undefined;

export function invalidateLibraryRootCache(): void {
  cachedLibraryRoot = undefined;
}

function configuredLibraryPath(cfg: LibraryRootConfig = readLibraryRootConfigSync()): string | null {
  const active = getActiveLibraryEntry(cfg);
  if (active?.path) return path.resolve(active.path);
  if (typeof cfg.path !== 'string' || !cfg.path.trim()) return null;
  return path.resolve(cfg.path.trim());
}

/** Сбрасывает привязку к удалённой папке и возвращает на экран настройки библиотеки. */
export async function reconcileLibraryRootConfig(): Promise<void> {
  const cfg = readLibraryRootConfigSync();
  const configured = configuredLibraryPath(cfg);
  if (!configured || fs.existsSync(configured)) return;

  if (isMultiLibraryConfig(cfg) && cfg.parentPath && fs.existsSync(cfg.parentPath)) {
    const remaining = (cfg.libraries ?? []).filter((l) => fs.existsSync(l.path));
    if (remaining.length > 0) {
      const sorted = [...remaining].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const nextActive = sorted[0]!;
      await writeLibraryRootConfig({
        ...cfg,
        libraries: sorted,
        activeLibraryId: nextActive.id,
        path: nextActive.path,
        pendingWrapMigrationPath: undefined
      });
      invalidateLibraryRootCache();
      return;
    }
  }

  await writeLibraryRootConfig({
    path: undefined,
    parentPath: undefined,
    activeLibraryId: undefined,
    libraries: undefined,
    pendingWrapMigrationPath: undefined,
    lastKnownCardCount: cfg.lastKnownCardCount,
    snapshotAt: cfg.snapshotAt
  });
  invalidateLibraryRootCache();

  await writeAppPreferences({
    onboardingSetupCompleted: false,
    onboardingSetupStep: 0,
    onboardingTourCompleted: false,
    onboardingTourStep: 0
  });
}

export function readLibraryRootConfig(): LibraryRootConfig {
  return readLibraryRootConfigSync();
}

export async function readLibraryRootFromDisk(): Promise<string | null> {
  if (cachedLibraryRoot !== undefined) return cachedLibraryRoot;
  cachedLibraryRoot = readLibraryRootSync();
  return cachedLibraryRoot;
}

export function readLibraryRootSync(): string | null {
  if (cachedLibraryRoot !== undefined) return cachedLibraryRoot;

  const configured = configuredLibraryPath();
  if (!configured) {
    cachedLibraryRoot = null;
    return null;
  }

  if (!fs.existsSync(configured)) {
    cachedLibraryRoot = null;
    return null;
  }

  cachedLibraryRoot = configured;
  return cachedLibraryRoot;
}

export async function writeLibraryRootToDisk(abs: string, extra?: Partial<LibraryRootConfig>): Promise<void> {
  const resolved = path.resolve(abs.trim());
  const current = readLibraryRootConfigSync();
  await writeLibraryRootConfig({
    ...current,
    ...extra,
    path: resolved
  });
  invalidateLibraryRootCache();
}

export function libraryConfigPath(): string {
  return path.join(app.getPath('userData'), 'library-root.json');
}

export function readParentLibraryPathSync(): string | null {
  const cfg = readLibraryRootConfigSync();
  if (cfg.parentPath?.trim() && fs.existsSync(cfg.parentPath)) {
    return path.resolve(cfg.parentPath);
  }
  return null;
}
