import { copyFile } from 'fs/promises';
import {
  fileExists,
  libraryMetaFileAbs,
  METADATA_BACKUP_FILENAME,
  METADATA_FILENAME,
  resolveLegacyMetadataAbsPath
} from '../libraryFilenames';
import { pruneLegacyTimestampedMetadataBackups } from './libraryMetaLayout';

/** Копирует arc-metadata.json в meta/arc-metadata.backup.json и удаляет устаревшие timestamp-копии. */
export async function writeCanonicalMetadataBackup(libraryRoot: string): Promise<void> {
  const metaPath = await resolveLegacyMetadataAbsPath(libraryRoot);
  if (!metaPath) return;
  await copyFile(metaPath, libraryMetaFileAbs(libraryRoot, METADATA_BACKUP_FILENAME));
  await pruneLegacyTimestampedMetadataBackups(libraryRoot);
}

export { pruneLegacyTimestampedMetadataBackups } from './libraryMetaLayout';
