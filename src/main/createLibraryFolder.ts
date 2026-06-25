import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import {
  DEFAULT_LIBRARY_FOLDER_NAME,
  isDirEmpty,
  isValidArcLibraryFolder,
  resolveAvailableLibraryFolderName
} from './libraryValidate';
import { fileExists } from './libraryFilenames';

export type CreateLibraryFolderResult =
  | { ok: true; absPath: string; folderName: string; existingArcLibrary: true }
  | { ok: true; absPath: string; folderName: string; existingArcLibrary: false }
  | { ok: false; error: string };

/**
 * Создаёт папку библиотеки в Documents/Библиотека ARC (или с суффиксом).
 * Если целевое имя уже занято валидной ARC-библиотекой — existingArcLibrary: true.
 */
export async function createDefaultLibraryFolder(): Promise<CreateLibraryFolderResult> {
  const parent = app.getPath('documents');
  const baseName = DEFAULT_LIBRARY_FOLDER_NAME;
  const targetAbs = path.join(parent, baseName);

  try {
    if (fs.existsSync(targetAbs) && (await isValidArcLibraryFolder(targetAbs))) {
      return {
        ok: true,
        absPath: targetAbs,
        folderName: baseName,
        existingArcLibrary: true
      };
    }

    const folderName = await resolveAvailableLibraryFolderName(parent, baseName);
    const absPath = path.join(parent, folderName);

    if (!(await fileExists(absPath))) {
      await mkdir(absPath, { recursive: true });
    }

    return { ok: true, absPath, folderName, existingArcLibrary: false };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Не удалось создать папку библиотеки'
    };
  }
}
