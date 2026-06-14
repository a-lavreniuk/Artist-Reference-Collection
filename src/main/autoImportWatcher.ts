import { BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import { readdir, stat } from 'fs/promises';
import path from 'path';

import { readAppPreferencesSync } from './appPreferences';
import { isVideoExt } from './ffmpeg';
import { readLibraryRootSync } from './libraryRootConfig';
import { isMaintenanceLocked } from './maintenanceLock';
import { ensureLibraryReady, importMediaFile } from './storage/libraryStorage';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
const DEBOUNCE_MS = 2000;
const STABLE_CHECK_MS = 2000;

let watcher: fs.FSWatcher | null = null;
let watchFolderPath: string | null = null;
let importQueue: string[] = [];
let processing = false;
let ipcRegistered = false;
let pendingRestart = false;

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingStableChecks = new Map<string, { size: number; timer: ReturnType<typeof setTimeout> }>();

function pathQueueKey(absPath: string): string {
  return process.platform === 'win32' ? path.resolve(absPath).toLowerCase() : path.resolve(absPath);
}

function isImportableFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.gif') return true;
  return IMAGE_EXT.has(ext) || isVideoExt(ext);
}

function isDirectChildOfWatchRoot(absPath: string): boolean {
  if (!watchFolderPath) return false;
  return path.resolve(path.dirname(absPath)) === path.resolve(watchFolderPath);
}

function broadcastProgress(payload: { current: number; total: number; message?: string }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:auto-import-progress', payload);
    }
  }
}

function broadcastBatchDone(payload: { imported: number; total: number; sourcePaths: string[] }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:auto-import-batch-done', payload);
    }
  }
}

function broadcastFinished(payload: { imported: number; attempted: number; sourcePaths: string[] }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:auto-import-finished', payload);
    }
  }
}

function clearDebounce(): void {
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();
  for (const entry of pendingStableChecks.values()) clearTimeout(entry.timer);
  pendingStableChecks.clear();
}

function stopWatcherInternal(): void {
  clearDebounce();
  if (watcher) {
    try {
      watcher.close();
    } catch {
      /* ignore */
    }
    watcher = null;
  }
  watchFolderPath = null;
}

export function stopAutoImportWatcher(): void {
  stopWatcherInternal();
  importQueue = [];
  processing = false;
  pendingRestart = false;
}

async function listImportableFilesInRoot(folderPath: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) continue;
      const abs = path.join(folderPath, ent.name);
      if (isImportableFile(abs)) out.push(abs);
    }
  } catch {
    /* ignore unreadable folder */
  }
  return out;
}

function enqueueUnique(absPath: string): void {
  const normalized = path.resolve(absPath);
  const key = pathQueueKey(normalized);
  if (importQueue.some((queued) => pathQueueKey(queued) === key)) return;
  importQueue.push(normalized);
}

function scheduleFileForImport(absPath: string): void {
  const normalized = path.resolve(absPath);
  if (!isDirectChildOfWatchRoot(normalized) || !isImportableFile(normalized)) return;

  const existing = debounceTimers.get(normalized);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    normalized,
    setTimeout(() => {
      debounceTimers.delete(normalized);
      void checkStableAndEnqueue(normalized);
    }, DEBOUNCE_MS)
  );
}

async function checkStableAndEnqueue(absPath: string): Promise<void> {
  let size: number;
  try {
    const st = await stat(absPath);
    if (!st.isFile()) return;
    size = st.size;
  } catch {
    return;
  }

  const prev = pendingStableChecks.get(absPath);
  if (prev) clearTimeout(prev.timer);

  pendingStableChecks.set(absPath, {
    size,
    timer: setTimeout(() => {
      void (async () => {
        try {
          const st = await stat(absPath);
          const entry = pendingStableChecks.get(absPath);
          if (!entry || !st.isFile() || st.size !== entry.size) {
            pendingStableChecks.delete(absPath);
            scheduleFileForImport(absPath);
            return;
          }
          pendingStableChecks.delete(absPath);
          enqueueUnique(absPath);
          void processQueue();
        } catch {
          pendingStableChecks.delete(absPath);
        }
      })();
    }, STABLE_CHECK_MS)
  });
}

async function processQueue(): Promise<void> {
  if (processing || isMaintenanceLocked()) return;

  const prefs = readAppPreferencesSync();
  if (!prefs.autoImportEnabled) return;

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return;

  processing = true;

  let sessionImported = 0;
  let sessionAttempted = 0;
  const sessionSuccessPaths: string[] = [];

  try {
    await ensureLibraryReady(libraryRoot);

    while (importQueue.length > 0) {
      if (isMaintenanceLocked() || !readAppPreferencesSync().autoImportEnabled) break;

      const batch: string[] = [];
      while (importQueue.length > 0) {
        batch.push(importQueue.shift()!);
      }
      if (!batch.length) break;

      const total = batch.length;
      const batchSuccessPaths: string[] = [];
      const batchImportedIds: string[] = [];

      for (let i = 0; i < batch.length; i++) {
        sessionAttempted += 1;
        broadcastProgress({
          current: i,
          total,
          message: `Автоимпорт: добавлено ${i} из ${total}`
        });
        const result = await importMediaFile(libraryRoot, batch[i]);
        if (result.ok) {
          batchSuccessPaths.push(batch[i]);
          batchImportedIds.push(result.row.id);
          sessionSuccessPaths.push(batch[i]);
          sessionImported += 1;
        }
        broadcastProgress({
          current: i + 1,
          total,
          message: `Автоимпорт: добавлено ${i + 1} из ${total}`
        });
      }

      broadcastBatchDone({
        imported: batchSuccessPaths.length,
        total,
        sourcePaths: batchSuccessPaths
      });

      if (batchImportedIds.length > 0) {
        const { queueCardsForIndexing } = await import('./ipcAi');
        void queueCardsForIndexing(batchImportedIds);
      }
    }
  } finally {
    processing = false;

    if (sessionAttempted > 0) {
      broadcastFinished({
        imported: sessionImported,
        attempted: sessionAttempted,
        sourcePaths: sessionSuccessPaths
      });
    }

    if (importQueue.length > 0 && !isMaintenanceLocked() && readAppPreferencesSync().autoImportEnabled) {
      void processQueue();
    } else if (pendingRestart) {
      pendingRestart = false;
      doRestartAutoImportWatcher();
    }
  }
}

async function scanAndImport(folderPath: string): Promise<void> {
  if (isMaintenanceLocked()) return;
  const prefs = readAppPreferencesSync();
  if (!prefs.autoImportEnabled) return;
  if (!readLibraryRootSync()) return;

  const files = await listImportableFilesInRoot(folderPath);
  for (const abs of files) enqueueUnique(abs);
  void processQueue();
}

export function resumeAutoImportIfNeeded(): void {
  if (importQueue.length > 0) {
    void processQueue();
  }
}

function doRestartAutoImportWatcher(): void {
  stopWatcherInternal();
  importQueue = [];
  processing = false;

  const prefs = readAppPreferencesSync();
  if (!prefs.autoImportEnabled || !prefs.autoImportFolderPath) return;

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return;

  const folderPath = path.resolve(prefs.autoImportFolderPath);
  try {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return;
  } catch {
    return;
  }

  watchFolderPath = folderPath;

  try {
    watcher = fs.watch(folderPath, (_eventType, filename) => {
      if (!filename) return;
      const name = filename.toString();
      if (name.includes('/') || name.includes('\\')) return;
      scheduleFileForImport(path.join(folderPath, name));
    });
    watcher.on('error', () => {
      stopWatcherInternal();
    });
  } catch {
    stopWatcherInternal();
    return;
  }

  void scanAndImport(folderPath);
}

export function restartAutoImportWatcher(): void {
  if (processing) {
    pendingRestart = true;
    stopWatcherInternal();
    return;
  }
  doRestartAutoImportWatcher();
}

export async function rescanAutoImportFolder(): Promise<void> {
  const prefs = readAppPreferencesSync();
  if (!prefs.autoImportFolderPath) return;
  const folderPath = path.resolve(prefs.autoImportFolderPath);
  await scanAndImport(folderPath);
}

export function registerAutoImportIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:auto-import-rescan', async () => {
    await rescanAutoImportFolder();
    return { ok: true as const };
  });
}
