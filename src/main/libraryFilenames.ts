import { mkdir, rename, stat, unlink } from 'fs/promises';
import path from 'path';

/** Подпапка служебных файлов библиотеки (индекс, настройки, история). */
export const LIBRARY_META_DIR = 'meta';

export const METADATA_FILENAME = 'arc-metadata.json';
/** Единственная защитная копия метаданных перед миграцией (перезаписывается, не плодится). */
export const METADATA_BACKUP_FILENAME = 'arc-metadata.backup.json';
export const HISTORY_FILENAME = 'arc-history.json';
export const PENDING_RESTORE_FILENAME = 'arc-pending-restore.json';
export const INDEX_DB_FILENAME = 'arc-index.db';
export const SYSTEM_FILENAME = 'arc-system.json';
export const MOODBOARD_FILENAME = 'arc-moodboard.json';
export const CARDS_DIR = 'cards';

export const LEGACY_METADATA_FILENAME = 'arc2-metadata.json';
export const LEGACY_HISTORY_FILENAME = 'arc2-history.json';
export const LEGACY_PENDING_RESTORE_FILENAME = 'arc2-pending-restore.json';

const PAIRS: Array<[string, string]> = [
  [LEGACY_METADATA_FILENAME, METADATA_FILENAME],
  [LEGACY_HISTORY_FILENAME, HISTORY_FILENAME],
  [LEGACY_PENDING_RESTORE_FILENAME, PENDING_RESTORE_FILENAME]
];

/** Файлы, которые хранятся в meta/ (и переносятся из корня при апгрейде layout). */
export const LIBRARY_META_BASENAMES = [
  METADATA_FILENAME,
  METADATA_BACKUP_FILENAME,
  HISTORY_FILENAME,
  PENDING_RESTORE_FILENAME,
  INDEX_DB_FILENAME,
  `${INDEX_DB_FILENAME}-wal`,
  `${INDEX_DB_FILENAME}-shm`,
  SYSTEM_FILENAME,
  MOODBOARD_FILENAME
] as const;

export function libraryMetaDirAbs(libraryRoot: string): string {
  return path.join(path.resolve(libraryRoot), LIBRARY_META_DIR);
}

export function libraryMetaFileAbs(libraryRoot: string, basename: string): string {
  return path.join(libraryMetaDirAbs(libraryRoot), basename);
}

export function libraryMetaFileRel(basename: string): string {
  return `${LIBRARY_META_DIR}/${basename}`.replace(/\\/g, '/');
}

export async function fileExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

/** Переименовывает legacy arc2-* → arc-* в указанной папке. */
export async function ensureLibraryFilenamesMigratedInDir(dir: string): Promise<void> {
  for (const [legacy, next] of PAIRS) {
    const legacyAbs = path.join(dir, legacy);
    const nextAbs = path.join(dir, next);
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

/** Переименовывает legacy-файлы в корне библиотеки и в meta/. */
export async function ensureLibraryFilenamesMigrated(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  await ensureLibraryFilenamesMigratedInDir(root);
  const metaDir = libraryMetaDirAbs(root);
  if (await fileExists(metaDir)) {
    await ensureLibraryFilenamesMigratedInDir(metaDir);
  }
}

/** Путь к arc-metadata.json: meta/ приоритетнее, затем корень (до переноса). */
export async function resolveLegacyMetadataAbsPath(libraryRoot: string): Promise<string | null> {
  const root = path.resolve(libraryRoot);
  const inMeta = libraryMetaFileAbs(root, METADATA_FILENAME);
  const inRoot = path.join(root, METADATA_FILENAME);
  if (await fileExists(inMeta)) return inMeta;
  if (await fileExists(inRoot)) return inRoot;
  return null;
}

export async function legacyMetadataExists(libraryRoot: string): Promise<boolean> {
  return (await resolveLegacyMetadataAbsPath(libraryRoot)) !== null;
}
