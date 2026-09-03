import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'fs';
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { isVideoExt, VIDEO_EXT } from './ffmpeg';
import { mediaOpenDialogProperties } from './mediaOpenDialogProperties';
import {
  getArcMediaServerOrigin,
  setActiveMediaTabAndSync,
  syncArcMediaServerLibraryRoot,
  syncArcMediaServerLibraryRoots
} from './media/mediaServerHost';
import { allowMediaStagingPaths, isAllowedStagingAbsPath, isTrashableAbsPath, registerMediaStagingToken } from './media/mediaStagingTokens';
import { consumeDestructiveConfirm, issueDestructiveConfirm } from './destructiveConfirm';
import type { DestructiveConfirmKind } from './destructiveConfirm';
import { acquireMaintenanceLock, isMaintenanceLocked, releaseMaintenanceLock } from './maintenanceLock';
import { appendHistory, clearHistory, readHistory, type HistorySegment } from './libraryHistory';
import {
  ensureLibraryFilenamesMigrated,
  INDEX_DB_FILENAME,
  libraryMetaFileAbs,
  METADATA_FILENAME,
  resolveLegacyMetadataAbsPath
} from './libraryFilenames';
import { registerStorageIpc } from './ipcStorage';
import { registerDuplicateIpc } from './ipcDuplicates';
import { resetLibraryStorageCache } from './storage/libraryStorage';
import { readLibraryDiskStats } from './libraryDiskStats';
import { getLibraryStatistics } from './libraryStatistics';
import {
  readLibraryRootFromDisk,
  readLibraryRootSync,
  readParentLibraryPathSync
} from './libraryRootConfig';
import { resolvePathToMediaUrl, resolvePathsToMediaUrls } from './toFileUrlHelper';
import { beginNavigationEpoch, endNavigationEpoch } from './ipcNavigationPriority';
import { applyLibraryFolderIcon } from './libraryFolderIcon';
import { isValidArcLibraryFolder } from './libraryValidate';
import { getDefaultLibraryFolderName } from './appProfile';
import { countCards, ensureLibraryReady, libraryCardsStatsReadonly } from './storage/libraryStorage';
import {
  updateLibrarySessionSnapshot,
  readLibraryRootConfigSync
} from './librarySessionSnapshot';
import {
  completeWrapMigration,
  createLibraryInContainer,
  deleteLibrary,
  getMigrationStatus,
  listLibrariesFromConfig,
  openLibraryOrContainer,
  renameLibrary,
  reorderLibraries,
  repairLibraryRegistryIfNeeded,
  switchActiveLibrary
} from './multiLibrary';
import { LIBRARY_CONTAINER_FOLDER_NAME } from './libraryContainer';

async function metadataPath(root: string): Promise<string | null> {
  return resolveLegacyMetadataAbsPath(root);
}

function assertNotMaintenance(): void {
  if (isMaintenanceLocked()) {
    throw new Error('Идёт операция…');
  }
}

async function finalizeLibraryPathChange(resolved: string, applyIcon: boolean): Promise<void> {
  syncArcMediaServerLibraryRoot(readLibraryRootSync());
  try {
    const roots: Record<string, string> = {};
    for (const lib of listLibrariesFromConfig()) roots[lib.id] = lib.path;
    syncArcMediaServerLibraryRoots(roots);
  } catch {
    /* media roots best-effort */
  }
  resetLibraryStorageCache();
  const { getActiveLibraryEntry, readLibraryRootConfigSync } = await import('./librarySessionSnapshot');
  const { seedAutoImportFromLegacyIfNeeded } = await import('./appPreferences');
  await seedAutoImportFromLegacyIfNeeded(getActiveLibraryEntry(readLibraryRootConfigSync())?.id ?? null);
  const { restartAutoImportWatcher } = await import('./autoImportWatcher');
  restartAutoImportWatcher();
  if (applyIcon) {
    const parent = readParentLibraryPathSync();
    void applyLibraryFolderIcon(parent ?? resolved);
  }
  try {
    await ensureLibraryReady(resolved);
    const n = countCards(resolved, 'all', 'all');
    await updateLibrarySessionSnapshot(resolved, n);
  } catch {
    /* snapshot best-effort */
  }
}

/** Без привязки к окну диалог выбора файлов на Windows часто не показывается поверх приложения. */
function dialogParentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

function showOpenDialogAttached(options: OpenDialogOptions) {
  const p = dialogParentWindow();
  if (p) {
    return dialog.showOpenDialog(p, options);
  }
  return dialog.showOpenDialog(options);
}

function isInsideLibrary(libRoot: string, candidateAbs: string): boolean {
  const root = path.resolve(libRoot);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Все файлы под `media/` с путями относительно корня библиотеки (`media/...`). */
async function walkLibraryMediaRelativeFiles(rootAbs: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(sub: string): Promise<void> {
    const base = path.join(rootAbs, ...sub.split('/').filter(Boolean));
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const relJoin = sub ? `${sub}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(relJoin);
      } else if (ent.isFile()) {
        out.push(relJoin.replace(/\\/g, '/'));
      }
    }
  }
  await walk('media');
  return out;
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

function isAllowedLibraryMediaExt(ext: string): boolean {
  const e = ext.toLowerCase();
  if (e === '.gif') return true;
  return isImageExt(e) || isVideoExt(e);
}

/** Расширения для диалога выбора: изображения + видео (совпадают с импортом). */
function mediaPickerExtensions(): string[] {
  const fromImages = [...IMAGE_EXT].map((x) => x.slice(1));
  const fromVideo = [...VIDEO_EXT].map((x) => x.slice(1));
  const merged = new Set([...fromImages, ...fromVideo]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

function mediaOpenDialogOptions(): OpenDialogOptions {
  const combined = mediaPickerExtensions();
  return {
    properties: mediaOpenDialogProperties(),
    filters: [
      { name: 'Изображения и видео', extensions: combined },
      {
        name: 'Изображения',
        extensions: [...IMAGE_EXT].map((x) => x.slice(1))
      },
      {
        name: 'Видео',
        extensions: [...VIDEO_EXT].map((x) => x.slice(1)).sort((a, b) => a.localeCompare(b))
      },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  };
}

/** Диалог выбора файлов для импорта. Без привязки к окну — если главное окно скрыто (трей). */
export async function pickMediaFilesForImport(options?: { attachToWindow?: boolean }): Promise<string[]> {
  const dialogOptions = mediaOpenDialogOptions();
  const attach = options?.attachToWindow !== false;
  const res = attach
    ? await showOpenDialogAttached(dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (res.canceled) return [];
  allowMediaStagingPaths(res.filePaths);
  return res.filePaths;
}

export type ImportedMediaRow = {
  id: string;
  type: 'image' | 'video';
  originalRelativePath: string;
  thumbRelativePath: string;
  fileSize: number;
  addedAt: string;
  width?: number;
  height?: number;
};

export type ImportFileResult =
  | { ok: true; row: ImportedMediaRow }
  | { ok: false; error: string };

let ipcRegistered = false;

export function registerArcIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('arc:set-active-media-tab', (event, tab: unknown) => {
    if (tab === 'gallery' || tab === 'collections' || tab === 'moodboard') {
      setActiveMediaTabAndSync(tab);
    } else {
      setActiveMediaTabAndSync(null);
    }
    event.returnValue = null;
  });

  ipcMain.on('arc:get-media-server-origin', (event) => {
    event.returnValue = getArcMediaServerOrigin();
  });

  ipcMain.on('arc:navigation-begin', (event) => {
    beginNavigationEpoch();
    event.returnValue = null;
  });

  ipcMain.on('arc:navigation-end', (event) => {
    endNavigationEpoch();
    event.returnValue = null;
  });

  registerStorageIpc(readLibraryRootFromDisk, assertNotMaintenance);
  registerDuplicateIpc(readLibraryRootFromDisk, assertNotMaintenance);

  ipcMain.handle('arc:maintenance-begin', async (_e, opts?: { silentUi?: boolean; reason?: unknown }) => {
    const reason = typeof opts?.reason === 'string' ? opts.reason.trim().slice(0, 64) : '';
    const token = acquireMaintenanceLock({
      silentUi: Boolean(opts?.silentUi),
      reason: reason || 'renderer'
    });
    return { ok: true as const, token };
  });

  ipcMain.handle('arc:maintenance-end', async (_e, token?: unknown) => {
    if (typeof token !== 'string' || !token.trim()) {
      return { ok: false as const, error: 'Нужен токен обслуживания' };
    }
    const released = releaseMaintenanceLock(token.trim());
    if (!released) {
      return { ok: false as const, error: 'Неизвестный токен обслуживания' };
    }
    return { ok: true as const };
  });

  ipcMain.handle('arc:request-destructive-confirm', async (_e, payload: unknown) => {
    const body = payload as { kind?: unknown; binding?: unknown; uses?: unknown } | null;
    const kind = body?.kind;
    const allowed: DestructiveConfirmKind[] = [
      'empty-trash',
      'permanent-delete-card',
      'delete-library-disk',
      'duplicate-delete-card'
    ];
    if (typeof kind !== 'string' || !allowed.includes(kind as DestructiveConfirmKind)) {
      return { ok: false as const, error: 'Некорректное действие' };
    }
    const binding = typeof body?.binding === 'string' ? body.binding : undefined;
    const uses = typeof body?.uses === 'number' ? body.uses : undefined;
    const token = issueDestructiveConfirm(kind as DestructiveConfirmKind, { binding, uses });
    return { ok: true as const, token };
  });

  ipcMain.handle('arc:get-library-path', async () => readLibraryRootFromDisk());

  ipcMain.handle('arc:list-libraries', async () => {
    try {
      await repairLibraryRegistryIfNeeded();
    } catch (err) {
      console.error('[ARC] repairLibraryRegistryIfNeeded:', err);
    }
    const items = listLibrariesFromConfig();
    const withCounts = items.map((item) => {
      let cardCount = 0;
      let sizeBytes = 0;
      try {
        if (fs.existsSync(item.path)) {
          const stats = libraryCardsStatsReadonly(item.path);
          cardCount = stats.cardCount;
          sizeBytes = stats.sizeBytes;
        }
      } catch {
        cardCount = 0;
        sizeBytes = 0;
      }
      return { ...item, cardCount, sizeBytes };
    });
    return { ok: true as const, libraries: withCounts };
  });

  ipcMain.handle('arc:get-library-migration-status', async () => getMigrationStatus());

  ipcMain.handle('arc:complete-library-wrap-migration', async (_e, name: unknown) => {
    assertNotMaintenance();
    if (typeof name !== 'string') {
      return { ok: false as const, error: 'Некорректное имя' };
    }
    const res = await completeWrapMigration(name);
    if (!res.ok) return res;
    const root = readLibraryRootSync();
    if (root) await finalizeLibraryPathChange(root, true);
    return { ok: true as const };
  });

  ipcMain.handle('arc:create-library-in-container', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const body = payload as { name?: unknown; parentHint?: unknown } | null;
    const name = typeof body?.name === 'string' ? body.name : '';
    const parentHint = typeof body?.parentHint === 'string' ? body.parentHint : null;
    const created = await createLibraryInContainer(name, parentHint);
    if (!created.ok) return created;
    // Новую папку готовим, а snapshot/active оставляем на текущей активной — иначе path уезжает на пустую.
    try {
      await ensureLibraryReady(created.library.path);
    } catch (err) {
      console.error('[ARC] ensureLibraryReady new library:', err);
    }
    const activeRoot = readLibraryRootSync();
    if (activeRoot) await finalizeLibraryPathChange(activeRoot, true);
    return { ok: true as const, library: created.library };
  });

  ipcMain.handle('arc:switch-active-library', async (_e, libraryId: unknown) => {
    assertNotMaintenance();
    if (typeof libraryId !== 'string' || !libraryId.trim()) {
      return { ok: false as const, error: 'Некорректный id' };
    }
    const switched = await switchActiveLibrary(libraryId.trim());
    if (!switched.ok) return switched;
    await finalizeLibraryPathChange(switched.path, false);
    return { ok: true as const, path: switched.path };
  });

  ipcMain.handle('arc:open-library-or-container', async (_e, absPath: unknown) => {
    assertNotMaintenance();
    if (typeof absPath !== 'string' || !absPath.trim()) {
      return { ok: false as const, error: 'Пустой путь' };
    }
    const opened = await openLibraryOrContainer(absPath.trim());
    if (!opened.ok) return opened;
    await finalizeLibraryPathChange(opened.path, true);
    return { ok: true as const, path: opened.path };
  });

  ipcMain.handle('arc:rename-library', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const body = payload as { id?: unknown; name?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    const name = typeof body?.name === 'string' ? body.name : '';
    const renamed = await renameLibrary(id, name);
    if (!renamed.ok) return renamed;
    const root = readLibraryRootSync();
    if (root) await finalizeLibraryPathChange(root, false);
    return { ok: true as const, library: renamed.library };
  });

  ipcMain.handle('arc:delete-library', async (_e, payload: unknown) => {
    assertNotMaintenance();
    const body = payload as { id?: unknown; mode?: unknown; confirmToken?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    const mode = body?.mode === 'disk' ? 'disk' : 'unlink';
    if (mode === 'disk') {
      if (!consumeDestructiveConfirm(body?.confirmToken, 'delete-library-disk', id)) {
        return { ok: false as const, error: 'Нужно подтверждение удаления' };
      }
    }
    const deleted = await deleteLibrary(id, mode);
    if (!deleted.ok) return deleted;
    const root = readLibraryRootSync();
    if (root) await finalizeLibraryPathChange(root, true);
    return { ok: true as const, switchedToId: deleted.switchedToId };
  });

  ipcMain.handle('arc:reorder-libraries', async (_e, orderedIds: unknown) => {
    assertNotMaintenance();
    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) {
      return { ok: false as const, error: 'Некорректный порядок' };
    }
    return reorderLibraries(orderedIds as string[]);
  });

  ipcMain.handle('arc:get-library-container-name', async () => LIBRARY_CONTAINER_FOLDER_NAME);

  ipcMain.handle('arc:get-parent-library-path', async () => readParentLibraryPathSync());

  ipcMain.handle('arc:set-library-path', async (_e, absPath: unknown) => {
    assertNotMaintenance();
    if (typeof absPath !== 'string' || !absPath.trim()) {
      return { ok: false as const, error: 'Пустой путь' };
    }
    const resolved = path.resolve(absPath.trim());
    try {
      const opened = await openLibraryOrContainer(resolved);
      if (!opened.ok) {
        return { ok: false as const, error: opened.error };
      }
      await finalizeLibraryPathChange(opened.path, true);
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось сохранить путь'
      };
    }
  });

  ipcMain.handle('arc:create-library-folder', async () => {
    assertNotMaintenance();
    // Dev/prod quick-create: Documents / Библиотека ARC / default child name
    const parent = app.getPath('documents');
    const folderName = getDefaultLibraryFolderName().replace(/\s*\(Dev\)\s*$/i, '').trim() || 'Основная';
    const childName = folderName === LIBRARY_CONTAINER_FOLDER_NAME ? 'Основная' : folderName;
    const created = await createLibraryInContainer(childName, parent);
    if (!created.ok) {
      return { ok: false as const, error: created.error };
    }
    try {
      try {
        await ensureLibraryReady(created.library.path);
      } catch (err) {
        console.error('[ARC] ensureLibraryReady new library:', err);
      }
      const activeRoot = readLibraryRootSync();
      if (activeRoot) await finalizeLibraryPathChange(activeRoot, true);
      return {
        ok: true as const,
        absPath: created.library.path,
        folderName: created.library.name,
        existingArcLibrary: false as const
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось создать библиотеку'
      };
    }
  });

  ipcMain.handle('arc:validate-library-folder', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) {
      return { ok: false as const, valid: false as const };
    }
    const resolved = path.resolve(absPath.trim());
    if (path.basename(resolved) === LIBRARY_CONTAINER_FOLDER_NAME) {
      return { ok: true as const, valid: true as const };
    }
    const parent = path.dirname(resolved);
    if (path.basename(parent) === LIBRARY_CONTAINER_FOLDER_NAME) {
      const valid = await isValidArcLibraryFolder(resolved);
      return { ok: true as const, valid };
    }
    const nested = path.join(resolved, LIBRARY_CONTAINER_FOLDER_NAME);
    try {
      await stat(nested);
      return { ok: true as const, valid: true as const };
    } catch {
      return { ok: true as const, valid: false as const };
    }
  });

  ipcMain.handle('arc:pick-library-folder', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle('arc:get-default-library-parent', async () => app.getPath('documents'));

  ipcMain.handle('arc:get-default-library-folder-name', async () => getDefaultLibraryFolderName());

  ipcMain.handle('arc:read-metadata', async () => {
    const root = await readLibraryRootFromDisk();
    if (!root) return null;
    await ensureLibraryFilenamesMigrated(root);
    const { libraryUsesNewStorage } = await import('./storage/db');
    if (libraryUsesNewStorage(root)) {
      return null;
    }
    try {
      const metaAbs = await metadataPath(root);
      if (!metaAbs) return null;
      const raw = await readFile(metaAbs, 'utf8');
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  });

  ipcMain.handle('arc:write-metadata', async (_e, data: unknown) => {
    assertNotMaintenance();
    const root = await readLibraryRootFromDisk();
    if (!root) throw new Error('Библиотека не выбрана');
    const { libraryUsesNewStorage } = await import('./storage/db');
    if (libraryUsesNewStorage(root)) {
      throw new Error('Библиотека использует новый формат хранения');
    }
    await ensureLibraryFilenamesMigrated(root);
    const dest = (await metadataPath(root)) ?? libraryMetaFileAbs(root, METADATA_FILENAME);
    const tmp = `${dest}.${process.pid}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    await writeFile(tmp, payload, 'utf8');
    await rename(tmp, dest);
  });

  ipcMain.handle('arc:pick-image-files', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    });
    if (res.canceled) return [];
    allowMediaStagingPaths(res.filePaths);
    return res.filePaths;
  });

  ipcMain.handle('arc:pick-media-files', async () => pickMediaFilesForImport({ attachToWindow: true }));

  ipcMain.handle('arc:classify-dropped-paths', async (_e, absolutePaths: unknown) => {
    if (!Array.isArray(absolutePaths) || !absolutePaths.every((x) => typeof x === 'string')) {
      throw new Error('Неверный список путей');
    }
    const paths = absolutePaths as string[];
    allowMediaStagingPaths(paths);
    const { classifyDroppedPaths } = await import('./importPathUtils');
    return classifyDroppedPaths(paths);
  });

  ipcMain.handle('arc:list-importable-files-in-directory', async (_e, folderPath: unknown) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) {
      throw new Error('Неверный путь к папке');
    }
    const resolvedFolder = path.resolve(folderPath.trim());
    const libraryRoot = readLibraryRootSync();
    if (!isAllowedStagingAbsPath(resolvedFolder, libraryRoot)) {
      throw new Error('Папка недоступна для импорта');
    }
    const { listImportableFilesInDirectoryRoot } = await import('./importPathUtils');
    const files = await listImportableFilesInDirectoryRoot(resolvedFolder);
    allowMediaStagingPaths(files);
    return files;
  });

  ipcMain.handle('arc:to-file-url', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return null;
    const root = readLibraryRootSync();
    return resolvePathToMediaUrl(relativePath, root, isVideoExt, getArcMediaServerOrigin());
  });

  ipcMain.handle('arc:to-file-urls', async (_e, relativePaths: unknown) => {
    if (!Array.isArray(relativePaths)) return {};
    const paths = relativePaths.filter((p): p is string => typeof p === 'string');
    const root = readLibraryRootSync();
    return resolvePathsToMediaUrls(paths, root, isVideoExt, getArcMediaServerOrigin());
  });

  ipcMain.handle('arc:register-media-staging-token', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) return null;
    return registerMediaStagingToken(absPath.trim(), readLibraryRootSync());
  });

  ipcMain.handle('arc:delete-file-if-inside-library', async (_e, relativePath: unknown) => {
    assertNotMaintenance();
    if (typeof relativePath !== 'string') return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    const abs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, abs)) return;
    try {
      await unlink(abs);
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle('arc:show-absolute-in-folder', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) return;
    const abs = path.resolve(absPath.trim());
    const libraryRoot = readLibraryRootSync();
    const parentLibrary = readParentLibraryPathSync();
    const allowed =
      (libraryRoot && (path.resolve(libraryRoot) === abs || isInsideLibrary(libraryRoot, abs))) ||
      (parentLibrary &&
        (path.resolve(parentLibrary) === abs ||
          (() => {
            const rel = path.relative(path.resolve(parentLibrary), abs);
            return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
          })())) ||
      isAllowedStagingAbsPath(abs, libraryRoot);
    if (!allowed) return;
    try {
      const st = await stat(abs);
      if (st.isDirectory()) {
        const probes = [
          libraryMetaFileAbs(abs, METADATA_FILENAME),
          libraryMetaFileAbs(abs, INDEX_DB_FILENAME),
          path.join(abs, METADATA_FILENAME)
        ];
        for (const probe of probes) {
          try {
            await stat(probe);
            shell.showItemInFolder(probe);
            return;
          } catch {
            /* next */
          }
        }
        shell.openPath(abs);
        return;
      }
      shell.showItemInFolder(abs);
    } catch {
      shell.openPath(abs);
    }
  });

  ipcMain.handle('arc:show-item-in-folder', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    const abs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, abs)) return;
    shell.showItemInFolder(abs);
  });

  ipcMain.handle('arc:open-external-url', async (_e, url: unknown) => {
    if (typeof url !== 'string' || !url.trim()) {
      return { ok: false as const, error: 'Пустой URL' };
    }
    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false as const, error: 'Недопустимый URL' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false as const, error: 'Недопустимый URL' };
    }
    try {
      await shell.openExternal(parsed.toString());
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось открыть ссылку';
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:save-media-to-folder', async (_e, relativePath: unknown) => {
    assertNotMaintenance();
    if (typeof relativePath !== 'string') {
      return { ok: false as const, error: 'Некорректный путь к файлу' };
    }
    const root = await readLibraryRootFromDisk();
    if (!root) {
      return { ok: false as const, error: 'Библиотека не выбрана' };
    }
    const sourceAbs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, sourceAbs)) {
      return { ok: false as const, error: 'Файл вне библиотеки' };
    }
    try {
      const sourceStat = await stat(sourceAbs);
      if (!sourceStat.isFile()) {
        return { ok: false as const, error: 'Исходный файл не найден' };
      }
    } catch {
      return { ok: false as const, error: 'Исходный файл не найден' };
    }

    const pick = await showOpenDialogAttached({
      properties: ['openDirectory', 'createDirectory']
    });
    if (pick.canceled || pick.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const };
    }

    const destinationDir = pick.filePaths[0];
    const destinationAbs = path.join(destinationDir, path.basename(sourceAbs));
    try {
      if (destinationAbs !== sourceAbs) {
        await copyFile(sourceAbs, destinationAbs);
      }
      return { ok: true as const, destinationPath: destinationAbs };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось сохранить файл'
      };
    }
  });

  ipcMain.handle('arc:dir-is-empty', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) return false;
    const resolved = path.resolve(absPath.trim());
    const libraryRoot = readLibraryRootSync();
    if (!isAllowedStagingAbsPath(resolved, libraryRoot)) return false;
    try {
      const names = await readdir(resolved);
      return names.length === 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'arc:migrate-library',
    async (): Promise<{ ok: false; error: string }> => {
      return {
        ok: false,
        error:
          'Перенос папки через ARC отключён. Перенесите «Библиотека ARC» средствами системы, затем укажите путь в Настройки → Библиотека.'
      };
    }
  );

  ipcMain.handle('arc:trash-path', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) return { ok: false as const, error: 'Пустой путь' };
    const resolved = path.resolve(absPath.trim());
    const libraryRoot = readLibraryRootSync();
    // Never trash inside the active library from this channel — only import/auto-import sources.
    if (libraryRoot && isInsideLibrary(libraryRoot, resolved)) {
      return { ok: false as const, error: 'Нельзя удалить файл библиотеки этим действием' };
    }
    let autoImportFolder: string | null = null;
    try {
      const { readAppPreferencesSync, resolveAutoImportForLibraryId } = await import('./appPreferences');
      const { getActiveLibraryEntry, readLibraryRootConfigSync } = await import('./librarySessionSnapshot');
      const active = getActiveLibraryEntry(readLibraryRootConfigSync());
      const auto = resolveAutoImportForLibraryId(readAppPreferencesSync(), active?.id ?? null);
      if (auto.enabled && auto.folderPath) autoImportFolder = auto.folderPath;
    } catch {
      /* ignore */
    }
    if (!isTrashableAbsPath(resolved, autoImportFolder)) {
      return { ok: false as const, error: 'Путь не разрешён для удаления' };
    }
    try {
      await shell.trashItem(resolved);
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        error: 'Не удалось переместить в корзину'
      };
    }
  });

  ipcMain.handle('arc:clipboard-import-write-temp', async () => {
    const { writeClipboardImageTemp } = await import('./clipboardImport');
    try {
      return await writeClipboardImageTemp();
    } catch {
      return { ok: false as const };
    }
  });

  ipcMain.handle('arc:clipboard-read-file-paths', async () => {
    const { readClipboardOsFilePaths } = await import('./clipboardImport');
    try {
      return readClipboardOsFilePaths();
    } catch {
      return [];
    }
  });

  ipcMain.handle('arc:clipboard-import-delete-temp', async (_e, absPath: unknown) => {
    const { deleteClipboardImportTemp } = await import('./clipboardImport');
    if (typeof absPath !== 'string') return { ok: false as const };
    try {
      return await deleteClipboardImportTemp(absPath);
    } catch {
      return { ok: false as const };
    }
  });

  ipcMain.handle('arc:read-history', async () => {
    const root = await readLibraryRootFromDisk();
    if (!root) return [];
    return readHistory(root);
  });

  ipcMain.handle('arc:append-history-line', async (_e, message: unknown, segments: unknown) => {
    assertNotMaintenance();
    if (typeof message !== 'string' || !message.trim()) return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    const safeSegments = Array.isArray(segments) ? (segments as HistorySegment[]) : undefined;
    await appendHistory(root, message.trim(), safeSegments);
  });

  ipcMain.handle('arc:clear-history', async () => {
    assertNotMaintenance();
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    await clearHistory(root);
  });

  ipcMain.handle('arc:verify-library-paths', async (_e, rels: unknown) => {
    const root = await readLibraryRootFromDisk();
    if (!root) return { missing: [] as string[] };
    if (!Array.isArray(rels)) return { missing: [] as string[] };
    const missing: string[] = [];
    for (const r of rels) {
      if (typeof r !== 'string' || !r.trim()) continue;
      const rel = r.replace(/\\/g, '/');
      const abs = path.resolve(root, rel.split('/').join(path.sep));
      if (!isInsideLibrary(root, abs)) {
        missing.push(rel);
        continue;
      }
      try {
        const st = await stat(abs);
        if (!st.isFile()) missing.push(rel);
      } catch {
        missing.push(rel);
      }
    }
    return { missing };
  });


  ipcMain.handle('arc:sum-library-files-bytes', async (_e, rels: unknown) => {
    const root = await readLibraryRootFromDisk();
    if (!root) return { ok: false as const, error: 'Библиотека не выбрана' };
    if (!Array.isArray(rels)) return { ok: false as const, error: 'Некорректные параметры' };
    const seen = new Set<string>();
    let totalBytes = 0;
    for (const item of rels) {
      if (typeof item !== 'string' || !item.trim()) continue;
      const rel = item.replace(/\\/g, '/');
      if (seen.has(rel)) continue;
      seen.add(rel);
      const abs = path.resolve(root, rel.split('/').join(path.sep));
      if (!isInsideLibrary(root, abs)) continue;
      try {
        const st = await stat(abs);
        if (st.isFile()) totalBytes += st.size;
      } catch {
        /* пропускаем отсутствующие */
      }
    }
    return { ok: true as const, totalBytes };
  });

  ipcMain.handle('arc:get-library-disk-stats', async (_e, payload?: unknown) => {
    const body = payload as { libraryId?: unknown } | null;
    const libraryId = typeof body?.libraryId === 'string' && body.libraryId.trim() ? body.libraryId.trim() : null;

    let root: string | null = null;
    if (libraryId) {
      const cfg = readLibraryRootConfigSync();
      const entry = (cfg.libraries ?? []).find((l) => l.id === libraryId);
      root = entry?.path ?? null;
    } else {
      root = await readLibraryRootFromDisk();
    }
    if (!root) return { ok: false as const, error: 'Библиотека не выбрана' };
    try {
      const stats = await readLibraryDiskStats(root);
      return { ok: true as const, ...stats };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось прочитать данные диска';
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:get-library-statistics', async (_e, payload?: unknown) => {
    const body = payload as { scope?: unknown } | null;
    const scopeRaw = typeof body?.scope === 'string' ? body.scope.trim() : 'all';
    const scope = scopeRaw || 'all';
    try {
      const stats = await getLibraryStatistics(scope);
      return { ok: true as const, ...stats };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось прочитать статистику';
      return { ok: false as const, error: message };
    }
  });
}
