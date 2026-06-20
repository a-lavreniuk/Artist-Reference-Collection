import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';

import { readAppPreferencesSync } from './appPreferences';
import { readLibraryRootSync } from './libraryRootConfig';
import { openLibraryDb } from './storage/db';
import {
  captureNavigationEpoch,
  isNavigationEpochStale,
  waitForNavigationIpc
} from './ipcNavigationPriority';

let duplicatesNotifiedThisSession = false;
let scanInFlight = false;
let ipcRegistered = false;

async function sha256File(absPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', () => resolve(null));
  });
}

function broadcastDuplicatesFound(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:duplicates-found', {});
    }
  }
}

export async function scanForDuplicateFiles(): Promise<boolean> {
  if (duplicatesNotifiedThisSession || scanInFlight) return false;

  const prefs = readAppPreferencesSync();
  if (!prefs.notifyDuplicatesFound) return false;

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return false;

  scanInFlight = true;
  const navSnap = captureNavigationEpoch();

  try {
    const db = openLibraryDb(libraryRoot);
    const rows = db
      .prepare(`SELECT original_rel AS originalRel FROM cards WHERE COALESCE(is_deleted, 0) = 0`)
      .all() as Array<{ originalRel: string }>;

    const hashCounts = new Map<string, number>();

    for (const row of rows) {
      if (isNavigationEpochStale(navSnap)) return false;
      await waitForNavigationIpc();
      const rel = row.originalRel.replace(/\//g, path.sep);
      const abs = path.join(libraryRoot, rel);
      const digest = await sha256File(abs);
      if (!digest) continue;
      hashCounts.set(digest, (hashCounts.get(digest) ?? 0) + 1);
    }

    const hasDuplicates = [...hashCounts.values()].some((count) => count >= 2);
    if (hasDuplicates) {
      duplicatesNotifiedThisSession = true;
      broadcastDuplicatesFound();
    }

    return hasDuplicates;
  } catch {
    return false;
  } finally {
    scanInFlight = false;
  }
}

export function registerDuplicateScanIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:duplicate-scan-start', async () => {
    void scanForDuplicateFiles();
    return { ok: true as const };
  });
}
