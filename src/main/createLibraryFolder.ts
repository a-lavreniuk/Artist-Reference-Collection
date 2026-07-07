import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import {
  isValidArcLibraryFolder,
  resolveAvailableLibraryFolderName,
  resolveFreshLibraryFolderName
} from './libraryValidate';
import { getDefaultLibraryFolderName, isDevProfile } from './appProfile';
import { fileExists } from './libraryFilenames';

export type CreateLibraryFolderResult =
  | { ok: true; absPath: string; folderName: string; existingArcLibrary: true }
  | { ok: true; absPath: string; folderName: string; existingArcLibrary: false }
  | { ok: false; error: string };

/**
 * Создаёт папку библиотеки в Documents.
 * Dev: «Библиотека ARC (Dev)», может предложить открыть существующую dev-библиотеку.
 * Prod: «Библиотека ARC», всегда новая папка (с суффиксом, если имя занято).
 */
export async function createDefaultLibraryFolder(): Promise<CreateLibraryFolderResult> {
  const parent = app.getPath('documents');
  const baseName = getDefaultLibraryFolderName();
  const targetAbs = path.join(parent, baseName);

  try {
    if (isDevProfile()) {
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
    }

    const folderName = await resolveFreshLibraryFolderName(parent, baseName);
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
