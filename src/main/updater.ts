import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

import { getReleaseNotesForVersion } from './releaseNotes';

const DISMISSED_FILENAME = 'update-dismissed-version.json';
const LAST_SEEN_FILENAME = 'last-seen-release-version.json';

type DismissedPayload = { version: string };
type LastSeenPayload = { version: string };

function dismissedPath(): string {
  return path.join(app.getPath('userData'), DISMISSED_FILENAME);
}

function lastSeenPath(): string {
  return path.join(app.getPath('userData'), LAST_SEEN_FILENAME);
}

function mainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

function sendToRenderer(channel: string, payload: unknown): void {
  const win = mainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

async function readDismissedVersion(): Promise<string | null> {
  try {
    const raw = await readFile(dismissedPath(), 'utf8');
    const j = JSON.parse(raw) as DismissedPayload;
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}

async function writeDismissedVersion(version: string): Promise<void> {
  await mkdir(path.dirname(dismissedPath()), { recursive: true });
  await writeFile(dismissedPath(), JSON.stringify({ version } satisfies DismissedPayload, null, 2), 'utf8');
}

async function readLastSeenVersion(): Promise<string | null> {
  try {
    const raw = await readFile(lastSeenPath(), 'utf8');
    const j = JSON.parse(raw) as LastSeenPayload;
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}

async function writeLastSeenVersion(version: string): Promise<void> {
  await mkdir(path.dirname(lastSeenPath()), { recursive: true });
  await writeFile(lastSeenPath(), JSON.stringify({ version } satisfies LastSeenPayload, null, 2), 'utf8');
}

let pendingInstall = false;

export function registerArcUpdaterIpc(): void {
  ipcMain.handle('arc:get-app-version', () => app.getVersion());

  ipcMain.handle('arc:get-release-notes', async (_e, version: unknown) => {
    const v = typeof version === 'string' && version.trim() ? version.trim() : app.getVersion();
    return getReleaseNotesForVersion(v);
  });

  ipcMain.handle('arc:get-last-seen-release-version', async () => readLastSeenVersion());

  ipcMain.handle('arc:set-last-seen-release-version', async (_e, version: unknown) => {
    if (typeof version !== 'string' || !version.trim()) return { ok: false as const };
    await writeLastSeenVersion(version.trim());
    return { ok: true as const };
  });

  ipcMain.handle('arc:dismiss-update-version', async (_e, version: unknown) => {
    if (typeof version !== 'string' || !version.trim()) return { ok: false as const };
    await writeDismissedVersion(version.trim());
    return { ok: true as const };
  });

  ipcMain.handle('arc:check-for-updates', async () => {
    if (!app.isPackaged) return { ok: false as const, reason: 'dev' as const };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true as const, updateInfo: result?.updateInfo ?? null };
    } catch (err) {
      console.error('[updater] checkForUpdates failed', err);
      return { ok: false as const, reason: 'error' as const };
    }
  });

  ipcMain.handle('arc:download-update', async () => {
    if (!app.isPackaged) return { ok: false as const };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true as const };
    } catch (err) {
      console.error('[updater] downloadUpdate failed', err);
      return { ok: false as const };
    }
  });

  ipcMain.handle('arc:quit-and-install', () => {
    if (!app.isPackaged) return { ok: false as const };
    pendingInstall = true;
    autoUpdater.quitAndInstall(false, true);
    return { ok: true as const };
  });
}

export function initArcUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    void (async () => {
      const dismissed = await readDismissedVersion();
      if (dismissed && dismissed === info.version) return;
      sendToRenderer('arc:update-available', {
        version: info.version,
        releaseDate: info.releaseDate ?? null
      });
    })();
  });

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('arc:update-not-available', {});
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('arc:update-download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('arc:update-downloaded', {});
    if (pendingInstall) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err);
    sendToRenderer('arc:update-error', { message: String(err?.message ?? err) });
  });

  const delayMs = 4000;
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] startup check failed', err);
    });
  }, delayMs);
}
