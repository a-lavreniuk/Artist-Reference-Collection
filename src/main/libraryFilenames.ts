import { rename, stat, unlink } from 'fs/promises';
import path from 'path';

export const METADATA_FILENAME = 'arc-metadata.json';
export const HISTORY_FILENAME = 'arc-history.json';
export const PENDING_RESTORE_FILENAME = 'arc-pending-restore.json';

export const LEGACY_METADATA_FILENAME = 'arc2-metadata.json';
export const LEGACY_HISTORY_FILENAME = 'arc2-history.json';
export const LEGACY_PENDING_RESTORE_FILENAME = 'arc2-pending-restore.json';

const PAIRS: Array<[string, string]> = [
  [LEGACY_METADATA_FILENAME, METADATA_FILENAME],
  [LEGACY_HISTORY_FILENAME, HISTORY_FILENAME],
  [LEGACY_PENDING_RESTORE_FILENAME, PENDING_RESTORE_FILENAME]
];

async function fileExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

/** Переименовывает legacy-файлы библиотеки в новые имена при первом доступе. */
export async function ensureLibraryFilenamesMigrated(libraryRoot: string): Promise<void> {
  for (const [legacy, next] of PAIRS) {
    const legacyAbs = path.join(libraryRoot, legacy);
    const nextAbs = path.join(libraryRoot, next);
    const hasLegacy = await fileExists(legacyAbs);
    const hasNext = await fileExists(nextAbs);
    if (!hasLegacy) continue;
    if (!hasNext) {
      await rename(legacyAbs, nextAbs);
      continue;
    }
    await unlink(legacyAbs);
  }
}
