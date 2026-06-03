import { mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import {
  ensureLibraryFilenamesMigrated,
  ensureLibraryFilenamesMigratedInDir,
  fileExists,
  LIBRARY_META_BASENAMES,
  libraryMetaDirAbs,
  METADATA_BACKUP_FILENAME
} from '../libraryFilenames';
import { closeLibraryDb } from './db';

/** Старый формат: arc-metadata.backup-2026-06-03T20-31-48-935Z.json */
const LEGACY_TIMESTAMPED_BACKUP_RE = /^arc-metadata\.backup-.+\.json$/;

async function pruneTimestampedMetadataBackupsInDir(dir: string): Promise<void> {
  let names: string[];
  try {
    const { readdir } = await import('fs/promises');
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!LEGACY_TIMESTAMPED_BACKUP_RE.test(name)) continue;
    try {
      await unlink(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Переносит служебные файлы из корня библиотеки в meta/.
 * Идемпотентно: повторный вызов безопасен.
 */
export async function ensureLibraryMetaDirLayout(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  await ensureLibraryFilenamesMigrated(root);

  const metaDir = libraryMetaDirAbs(root);
  await mkdir(metaDir, { recursive: true });

  closeLibraryDb();

  for (const name of LIBRARY_META_BASENAMES) {
    const atRoot = path.join(root, name);
    const atMeta = path.join(metaDir, name);
    const hasRoot = await fileExists(atRoot);
    const hasMeta = await fileExists(atMeta);
    if (hasRoot && !hasMeta) {
      await rename(atRoot, atMeta);
    } else if (hasRoot && hasMeta) {
      try {
        await unlink(atRoot);
      } catch {
        /* ignore */
      }
    }
  }

  await pruneTimestampedMetadataBackupsInDir(root);
  await pruneTimestampedMetadataBackupsInDir(metaDir);
  await ensureLibraryFilenamesMigratedInDir(metaDir);
}

/** @deprecated используйте libraryMetaFileAbs */
export async function pruneLegacyTimestampedMetadataBackups(libraryRoot: string): Promise<void> {
  await pruneTimestampedMetadataBackupsInDir(path.resolve(libraryRoot));
  await pruneTimestampedMetadataBackupsInDir(libraryMetaDirAbs(libraryRoot));
}
