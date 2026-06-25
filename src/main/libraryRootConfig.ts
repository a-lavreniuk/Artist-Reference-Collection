import { app } from 'electron';
import path from 'path';
import {
  readLibraryRootConfigSync,
  writeLibraryRootConfig,
  type LibraryRootConfig
} from './librarySessionSnapshot';

let cachedLibraryRoot: string | null | undefined;

export function invalidateLibraryRootCache(): void {
  cachedLibraryRoot = undefined;
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
  const cfg = readLibraryRootConfigSync();
  if (typeof cfg.path !== 'string' || !cfg.path.trim()) {
    cachedLibraryRoot = null;
    return null;
  }
  cachedLibraryRoot = path.resolve(cfg.path.trim());
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
