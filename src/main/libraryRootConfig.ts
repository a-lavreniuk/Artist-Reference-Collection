import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const LIBRARY_CONFIG_FILENAME = 'library-root.json';

function libraryConfigPath(): string {
  return path.join(app.getPath('userData'), LIBRARY_CONFIG_FILENAME);
}

let cachedLibraryRoot: string | null | undefined;

export function invalidateLibraryRootCache(): void {
  cachedLibraryRoot = undefined;
}

export async function readLibraryRootFromDisk(): Promise<string | null> {
  if (cachedLibraryRoot !== undefined) return cachedLibraryRoot;
  cachedLibraryRoot = readLibraryRootSync();
  return cachedLibraryRoot;
}

export function readLibraryRootSync(): string | null {
  if (cachedLibraryRoot !== undefined) return cachedLibraryRoot;
  try {
    const raw = fs.readFileSync(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) {
      cachedLibraryRoot = null;
      return null;
    }
    cachedLibraryRoot = path.resolve(j.path.trim());
    return cachedLibraryRoot;
  } catch {
    cachedLibraryRoot = null;
    return null;
  }
}
