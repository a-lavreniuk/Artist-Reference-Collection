import { readdir, stat } from 'fs/promises';
import path from 'path';
import {
  CARDS_DIR,
  fileExists,
  INDEX_DB_FILENAME,
  libraryMetaFileAbs,
  SYSTEM_FILENAME
} from './libraryFilenames';
import { libraryUsesNewStorage } from './storage/db';

export const DEFAULT_LIBRARY_FOLDER_NAME = 'Библиотека ARC';

export async function isDirEmpty(abs: string): Promise<boolean> {
  try {
    const names = await readdir(abs);
    return names.length === 0;
  } catch {
    return false;
  }
}

/** Признаки библиотеки ARC v2 или legacy с метаданными. */
export async function isValidArcLibraryFolder(abs: string): Promise<boolean> {
  const root = path.resolve(abs);
  try {
    const st = await stat(root);
    if (!st.isDirectory()) return false;
  } catch {
    return false;
  }

  if (libraryUsesNewStorage(root)) return true;

  const systemMeta = libraryMetaFileAbs(root, SYSTEM_FILENAME);
  if (await fileExists(systemMeta)) return true;

  const indexMeta = libraryMetaFileAbs(root, INDEX_DB_FILENAME);
  if (await fileExists(indexMeta)) return true;

  const cardsDir = path.join(root, CARDS_DIR);
  if (await fileExists(cardsDir)) {
    try {
      const entries = await readdir(cardsDir);
      if (entries.length > 0) return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

/** Имя для новой библиотеки: в prod не переиспользует занятую папку, даже если там уже ARC-библиотека. */
export async function resolveFreshLibraryFolderName(parentDir: string, baseName: string): Promise<string> {
  const parent = path.resolve(parentDir);
  let n = 1;
  for (;;) {
    const name = n === 1 ? baseName : `${baseName} (${n})`;
    const candidateAbs = path.join(parent, name);
    if (!(await fileExists(candidateAbs))) return name;
    if (await isDirEmpty(candidateAbs)) return name;
    n += 1;
    if (n > 999) return `${baseName} (${Date.now()})`;
  }
}

export async function resolveAvailableLibraryFolderName(parentDir: string, baseName: string): Promise<string> {
  const parent = path.resolve(parentDir);
  const first = path.join(parent, baseName);
  if (!(await fileExists(first))) return baseName;

  if (await isDirEmpty(first)) return baseName;

  if (await isValidArcLibraryFolder(first)) return baseName;

  let n = 2;
  for (;;) {
    const candidate = `${baseName} (${n})`;
    const candidateAbs = path.join(parent, candidate);
    if (!(await fileExists(candidateAbs))) return candidate;
    if (await isDirEmpty(candidateAbs)) return candidate;
    if (await isValidArcLibraryFolder(candidateAbs)) return candidate;
    n += 1;
    if (n > 999) return `${baseName} (${Date.now()})`;
  }
}
