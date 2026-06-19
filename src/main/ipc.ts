import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'fs';
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { isVideoExt, VIDEO_EXT } from './ffmpeg';
import { acquireMaintenanceLock, isMaintenanceLocked, releaseMaintenanceLock } from './maintenanceLock';
import { migrateLibraryToFolder } from './libraryMigrate';
import { appendHistory, readHistory } from './libraryHistory';
import { runBackup } from './backupLibrary';
import { discoverBackupParts, restoreFromParts } from './restoreLibrary';
import {
  ensureLibraryFilenamesMigrated,
  INDEX_DB_FILENAME,
  LEGACY_PENDING_RESTORE_FILENAME,
  libraryMetaFileAbs,
  METADATA_FILENAME,
  PENDING_RESTORE_FILENAME,
  resolveLegacyMetadataAbsPath
} from './libraryFilenames';
import { registerStorageIpc } from './ipcStorage';
import { resetLibraryStorageCache } from './storage/libraryStorage';
import { readLibraryDiskStats } from './libraryDiskStats';
const LIBRARY_CONFIG_FILENAME = 'library-root.json';

function libraryConfigPath(): string {
  return path.join(app.getPath('userData'), LIBRARY_CONFIG_FILENAME);
}

async function readLibraryRootFromDisk(): Promise<string | null> {
  try {
    const raw = await readFile(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return path.resolve(j.path.trim());
  } catch {
    return null;
  }
}

function readLibraryRootSync(): string | null {
  try {
    const raw = fs.readFileSync(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return path.resolve(j.path.trim());
  } catch {
    return null;
  }
}

async function writeLibraryRootToDisk(abs: string): Promise<void> {
  await mkdir(path.dirname(libraryConfigPath()), { recursive: true });
  await writeFile(libraryConfigPath(), JSON.stringify({ path: abs }, null, 2), 'utf8');
}

async function metadataPath(root: string): Promise<string | null> {
  return resolveLegacyMetadataAbsPath(root);
}

function assertNotMaintenance(): void {
  if (isMaintenanceLocked()) {
    throw new Error('Идёт операция…');
  }
}

function pendingRestorePath(): string {
  return path.join(app.getPath('userData'), PENDING_RESTORE_FILENAME);
}

async function ensurePendingRestoreMigrated(): Promise<void> {
  const nextAbs = pendingRestorePath();
  const legacyAbs = path.join(app.getPath('userData'), LEGACY_PENDING_RESTORE_FILENAME);
  try {
    await stat(nextAbs);
    return;
  } catch {
    /* continue */
  }
  try {
    await stat(legacyAbs);
    await rename(legacyAbs, nextAbs);
  } catch {
    /* no legacy file */
  }
}

let backupAbortController: AbortController | null = null;

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
let arcMediaProtocolRegistered = false;

/**
 * Превью с http://localhost:5173 не могут грузить file:// — регистрируем безопасную схему `arc-media`.
 *
 * - `?rel=` — относительный путь внутри библиотеки (как раньше).
 * - `?abs=` — абсолютный путь к произвольному файлу на диске (для импорта «снаружи» библиотеки).
 */
export function registerArcMediaProtocol(): void {
  if (arcMediaProtocolRegistered) return;
  arcMediaProtocolRegistered = true;

  protocol.registerFileProtocol('arc-media', (request, callback) => {
    try {
      const u = new URL(request.url);
      const relEncoded = u.searchParams.get('rel');
      const absEncoded = u.searchParams.get('abs');

      let abs: string | null = null;

      if (absEncoded) {
        abs = path.resolve(decodeURIComponent(absEncoded));
      } else if (relEncoded) {
        const relativePath = relEncoded.replace(/\\/g, '/');
        const root = readLibraryRootSync();
        if (!root) {
          callback({ error: -6 });
          return;
        }
        const resolved = path.resolve(root, relativePath.replace(/\//g, path.sep));
        if (!isInsideLibrary(root, resolved)) {
          callback({ error: -2 });
          return;
        }
        abs = resolved;
      } else {
        callback({ error: -2 });
        return;
      }

      if (!abs) {
        callback({ error: -2 });
        return;
      }

      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        callback({ error: -6 });
        return;
      }

      const ext = path.extname(abs);
      if (!isAllowedLibraryMediaExt(ext)) {
        callback({ error: -2 });
        return;
      }

      callback({ path: abs });
    } catch {
      callback({ error: -2 });
    }
  });
}

export function registerArcIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  registerStorageIpc(readLibraryRootFromDisk, assertNotMaintenance);

  ipcMain.handle('arc:maintenance-begin', async () => {
    acquireMaintenanceLock();
    return { ok: true as const };
  });

  ipcMain.handle('arc:maintenance-end', async () => {
    releaseMaintenanceLock();
    return { ok: true as const };
  });

  ipcMain.handle('arc:get-library-path', async () => readLibraryRootFromDisk());

  ipcMain.handle('arc:set-library-path', async (_e, absPath: unknown) => {
    assertNotMaintenance();
    if (typeof absPath !== 'string' || !absPath.trim()) {
      return { ok: false as const, error: 'Пустой путь' };
    }
    const resolved = path.resolve(absPath.trim());
    try {
      await mkdir(resolved, { recursive: true });
      await writeLibraryRootToDisk(resolved);
      resetLibraryStorageCache();
      const { restartAutoImportWatcher } = await import('./autoImportWatcher');
      restartAutoImportWatcher();
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось сохранить путь'
      };
    }
  });

  ipcMain.handle('arc:pick-library-folder', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0] ?? null;
  });

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
    return res.filePaths;
  });

  ipcMain.handle('arc:pick-media-files', async () => {
    const combined = mediaPickerExtensions();
    const res = await showOpenDialogAttached({
      properties: ['openFile', 'multiSelections'],
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
    });
    if (res.canceled) return [];
    return res.filePaths;
  });


  ipcMain.handle('arc:to-file-url', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return null;
    const root = await readLibraryRootFromDisk();
    const { resolvePathToMediaUrl } = await import('./toFileUrlHelper');
    return resolvePathToMediaUrl(relativePath, root, isVideoExt);
  });

  ipcMain.handle('arc:to-file-urls', async (_e, relativePaths: unknown) => {
    if (!Array.isArray(relativePaths)) return {};
    const paths = relativePaths.filter((p): p is string => typeof p === 'string');
    const root = await readLibraryRootFromDisk();
    const { resolvePathsToMediaUrls } = await import('./toFileUrlHelper');
    return resolvePathsToMediaUrls(paths, root, isVideoExt);
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
    if (!/^https?:\/\//i.test(trimmed)) {
      return { ok: false as const, error: 'Недопустимый URL' };
    }
    try {
      await shell.openExternal(trimmed);
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
    try {
      const names = await readdir(resolved);
      return names.length === 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'arc:migrate-library',
    async (_e, targetPath: unknown): Promise<{ ok: true; oldLibraryPath: string } | { ok: false; error: string }> => {
      if (isMaintenanceLocked()) {
        return { ok: false, error: 'Идёт операция…' };
      }
      if (typeof targetPath !== 'string' || !targetPath.trim()) {
        return { ok: false, error: 'Пустой путь' };
      }
      const oldRoot = await readLibraryRootFromDisk();
      if (!oldRoot) return { ok: false, error: 'Библиотека не выбрана' };
      const newRoot = path.resolve(targetPath.trim());
      acquireMaintenanceLock();
      try {
        const res = await migrateLibraryToFolder(oldRoot, newRoot);
        if (!res.ok) return res;
        await writeLibraryRootToDisk(newRoot);
        const { restartAutoImportWatcher } = await import('./autoImportWatcher');
        restartAutoImportWatcher();
        try {
          await appendHistory(newRoot, 'Перенос хранилища завершён');
        } catch {
          /* ignore */
        }
        return { ok: true, oldLibraryPath: oldRoot };
      } finally {
        releaseMaintenanceLock();
      }
    }
  );

  ipcMain.handle('arc:trash-path', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) return { ok: false as const, error: 'Пустой путь' };
    try {
      await shell.trashItem(path.resolve(absPath.trim()));
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось переместить в корзину'
      };
    }
  });

  ipcMain.handle('arc:read-history', async () => {
    const root = await readLibraryRootFromDisk();
    if (!root) return [];
    return readHistory(root);
  });

  ipcMain.handle('arc:append-history-line', async (_e, message: unknown) => {
    assertNotMaintenance();
    if (typeof message !== 'string' || !message.trim()) return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    await appendHistory(root, message.trim());
  });

  ipcMain.handle('arc:pick-backup-archive', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openFile'],
      filters: [{ name: 'ARC backup', extensions: ['arc'] }]
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle('arc:backup-start', async (event, opts: unknown) => {
    if (isMaintenanceLocked()) {
      return { ok: false as const, error: 'Идёт операция…' };
    }
    const root = await readLibraryRootFromDisk();
    if (!root) return { ok: false as const, error: 'Библиотека не выбрана' };
    if (!opts || typeof opts !== 'object') return { ok: false as const, error: 'Некорректные параметры' };
    const o = opts as { destDir?: unknown; partCount?: unknown };
    if (typeof o.destDir !== 'string' || !o.destDir.trim()) {
      return { ok: false as const, error: 'Не указана папка назначения' };
    }
    const partCount = o.partCount === 2 || o.partCount === 4 || o.partCount === 8 ? o.partCount : 1;
    const destDir = path.resolve(o.destDir.trim());
    const win = BrowserWindow.fromWebContents(event.sender);
    backupAbortController = new AbortController();
    acquireMaintenanceLock();
    try {
      const result = await runBackup({
        libraryRoot: root,
        destDir,
        partCount,
        signal: backupAbortController.signal,
        onProgress(p) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('arc:backup-progress', p);
          }
        }
      });
      return result;
    } finally {
      releaseMaintenanceLock();
      backupAbortController = null;
    }
  });

  ipcMain.handle('arc:backup-cancel', async () => {
    backupAbortController?.abort();
    return { ok: true as const };
  });

  ipcMain.handle(
    'arc:restore-library',
    async (
      _e,
      payload: unknown
    ): Promise<{ ok: true; restart: true } | { ok: false; error: string }> => {
      if (isMaintenanceLocked()) {
        return { ok: false, error: 'Идёт операция…' };
      }
      if (!payload || typeof payload !== 'object') return { ok: false, error: 'Некорректные параметры' };
      const p = payload as { firstPartPath?: unknown; destDir?: unknown };
      if (typeof p.firstPartPath !== 'string' || typeof p.destDir !== 'string') {
        return { ok: false, error: 'Не указаны пути' };
      }
      const dest = path.resolve(p.destDir.trim());
      let restart = false;
      acquireMaintenanceLock();
      try {
        const parts = await discoverBackupParts(p.firstPartPath.trim());
        const res = await restoreFromParts(parts, dest);
        if (!res.ok) return res;
        await writeLibraryRootToDisk(dest);
        const { restartAutoImportWatcher } = await import('./autoImportWatcher');
        restartAutoImportWatcher();
        await writeFile(
          pendingRestorePath(),
          JSON.stringify({ message: 'Библиотека восстановлена из резервной копии.' }, null, 2),
          'utf8'
        );
        restart = true;
        return { ok: true, restart: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Ошибка восстановления'
        };
      } finally {
        releaseMaintenanceLock();
        if (restart) {
          setImmediate(() => {
            app.relaunch();
            app.exit(0);
          });
        }
      }
    }
  );

  ipcMain.handle('arc:consume-pending-restore-modal', async () => {
    await ensurePendingRestoreMigrated();
    const p = pendingRestorePath();
    try {
      const raw = await readFile(p, 'utf8');
      await unlink(p);
      const j = JSON.parse(raw) as { message?: string };
      return typeof j.message === 'string' ? { message: j.message } : null;
    } catch {
      return null;
    }
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

  ipcMain.handle('arc:get-library-disk-stats', async () => {
    const root = await readLibraryRootFromDisk();
    if (!root) return { ok: false as const, error: 'Библиотека не выбрана' };
    try {
      const stats = await readLibraryDiskStats(root);
      return { ok: true as const, ...stats };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось прочитать данные диска';
      return { ok: false as const, error: message };
    }
  });
}
