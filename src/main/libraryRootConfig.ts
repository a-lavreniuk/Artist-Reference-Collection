import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  readLibraryRootConfigSync,
  writeLibraryRootConfig,
  type LibraryRootConfig
} from './librarySessionSnapshot';
import { writeAppPreferences } from './appPreferences';

let cachedLibraryRoot: string | null | undefined;

export function invalidateLibraryRootCache(): void {
  cachedLibraryRoot = undefined;
}

function configuredLibraryPath(cfg: LibraryRootConfig = readLibraryRootConfigSync()): string | null {
  if (typeof cfg.path !== 'string' || !cfg.path.trim()) return null;
  return path.resolve(cfg.path.trim());
}

/** Сбрасывает привязку к удалённой папке и возвращает на экран настройки библиотеки. */
export async function reconcileLibraryRootConfig(): Promise<void> {
  const cfg = readLibraryRootConfigSync();
  const configured = configuredLibraryPath(cfg);
  if (!configured || fs.existsSync(configured)) return;

  const { path: _removed, ...rest } = cfg;
  await writeLibraryRootConfig(rest);
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
