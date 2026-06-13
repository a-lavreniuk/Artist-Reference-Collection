import { app } from 'electron';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

const LIBRARY_CONFIG_FILENAME = 'library-root.json';

function libraryConfigPath(): string {
  return path.join(app.getPath('userData'), LIBRARY_CONFIG_FILENAME);
}

export async function readLibraryRootFromDisk(): Promise<string | null> {
  try {
    const raw = await readFile(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return path.resolve(j.path.trim());
  } catch {
    return null;
  }
}

export function readLibraryRootSync(): string | null {
  try {
    const raw = fs.readFileSync(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return path.resolve(j.path.trim());
  } catch {
    return null;
  }
}
