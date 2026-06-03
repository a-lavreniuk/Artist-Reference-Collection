import { readdir, rm } from 'fs/promises';
import path from 'path';

/** Удаляет пустую legacy-папку media/ после миграции на cards/. */
export async function removeEmptyLegacyMediaDir(libraryRoot: string): Promise<void> {
  const mediaRoot = path.join(path.resolve(libraryRoot), 'media');
  try {
    const entries = await readdir(mediaRoot);
    if (entries.length === 0) {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  } catch {
    /* папки нет или не пустая — не трогаем */
  }
}
