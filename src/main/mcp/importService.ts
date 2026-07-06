import { mkdtemp, writeFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

import { handleItemAdd } from '../importApi/importApiHandlers';
import { downloadUrlToTempFile } from '../importApi/importFromRemote';
import { MAX_IMPORT_BODY_BYTES } from '../importApi/constants';
import type { ImportApiHandlerDeps } from '../importApi/types';
import { readAppPreferencesSync } from '../appPreferences';
import { queueCardsForIndexing } from '../ipcAi';
import { refreshLibrarySessionSnapshotFromDisk } from '../librarySessionSnapshot';
import { notifyRendererExtensionImport } from '../importApi/notifyRenderer';
import {
  checkImportDuplicates,
  isExactDuplicateIncomingFile
} from '../duplicateScanService';
import { importMediaFile } from '../storage/libraryStorage';
import { buildMcpDeps } from './mcpDeps';

function resolveCardNameFromPrefs(pageTitle?: string, explicitName?: string): string | undefined {
  const prefs = readAppPreferencesSync();
  const explicit = explicitName?.trim();
  if (explicit) {
    if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
      return `${prefs.importApiPrefixText.trim()} ${explicit}`;
    }
    return explicit;
  }
  const title = pageTitle?.trim();
  if (!title) return undefined;
  if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
    return `${prefs.importApiPrefixText.trim()} ${title}`;
  }
  return title;
}

export function buildImportDeps(libraryRoot: string): ImportApiHandlerDeps {
  return {
    getAppVersion: () => buildMcpDeps().getAppVersion(),
    getPlatform: () => buildMcpDeps().getPlatform(),
    getLibraryRoot: () => libraryRoot,
    isApiEnabled: () => true,
    resolveCardName: resolveCardNameFromPrefs,
    importFromUrl: async ({ libraryRoot: root, url, website, name }) => {
      let cleanup: (() => Promise<void>) | null = null;
      try {
        const { tempPath, cleanup: rm } = await downloadUrlToTempFile(url, MAX_IMPORT_BODY_BYTES);
        cleanup = rm;
        const result = await importMediaFile(root, tempPath, {
          linkUrl: website,
          name
        });
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        void queueCardsForIndexing([result.row.id]);
        void refreshLibrarySessionSnapshotFromDisk();
        notifyRendererExtensionImport([result.row.id]);
        return { ok: true, id: result.row.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        return { ok: false, error: message };
      } finally {
        if (cleanup) await cleanup();
      }
    }
  };
}

export async function importFromBase64(
  libraryRoot: string,
  input: {
    base64: string;
    mimeType?: string;
    name?: string;
    website?: string;
  }
): Promise<{ id: string }> {
  const raw = input.base64.trim();
  const data = raw.includes(',') ? raw.split(',').pop() ?? '' : raw;
  if (!data) throw new Error('Пустые данные base64');

  const buf = Buffer.from(data, 'base64');
  if (buf.length === 0) throw new Error('Некорректные данные base64');
  if (buf.length > MAX_IMPORT_BODY_BYTES) {
    throw new Error('Файл слишком большой');
  }

  const extFromMime =
    input.mimeType === 'image/png'
      ? '.png'
      : input.mimeType === 'image/webp'
        ? '.webp'
        : input.mimeType === 'image/gif'
          ? '.gif'
          : input.mimeType === 'video/mp4'
            ? '.mp4'
            : '.jpg';

  const dir = await mkdtemp(path.join(os.tmpdir(), 'arc-mcp-import-'));
  const tempPath = path.join(dir, `import${extFromMime}`);
  await writeFile(tempPath, buf);
  try {
    const result = await importMediaFile(libraryRoot, tempPath, {
      linkUrl: input.website,
      name: resolveCardNameFromPrefs(undefined, input.name)
    });
    if (!result.ok) throw new Error(result.error);
    void queueCardsForIndexing([result.row.id]);
    void refreshLibrarySessionSnapshotFromDisk();
    notifyRendererExtensionImport([result.row.id]);
    return { id: result.row.id };
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

export async function importLocalFiles(
  libraryRoot: string,
  absolutePaths: string[]
): Promise<{ imported: string[]; errors: Array<{ path: string; error: string }> }> {
  const imported: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const filePath of absolutePaths) {
    try {
      const result = await importMediaFile(libraryRoot, filePath);
      if (!result.ok) {
        errors.push({ path: filePath, error: result.error });
        continue;
      }
      imported.push(result.row.id);
      void queueCardsForIndexing([result.row.id]);
    } catch (err) {
      errors.push({
        path: filePath,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  if (imported.length > 0) {
    void refreshLibrarySessionSnapshotFromDisk();
    notifyRendererExtensionImport(imported);
  }
  return { imported, errors };
}

export async function checkImportDuplicate(
  libraryRoot: string,
  absolutePath: string
): Promise<{ isDuplicate: boolean; matches?: Awaited<ReturnType<typeof checkImportDuplicates>> }> {
  const exact = await isExactDuplicateIncomingFile(libraryRoot, absolutePath);
  if (exact) return { isDuplicate: true };
  const matches = await checkImportDuplicates(libraryRoot, [absolutePath]);
  return { isDuplicate: matches.length > 0, ...(matches.length ? { matches } : {}) };
}

export async function importFromUrlViaHandler(
  libraryRoot: string,
  body: Record<string, unknown>
): Promise<{ id: string }> {
  const result = await handleItemAdd(buildImportDeps(libraryRoot), body);
  if (result.body.status === 'error') {
    throw new Error(result.body.message);
  }
  return result.body.data;
}
