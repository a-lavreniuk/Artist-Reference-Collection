import { randomBytes } from 'crypto';

import { BrowserWindow } from 'electron';

type LockEntry = {
  token: string;
  silentUi: boolean;
};

const stack: LockEntry[] = [];

function currentSilentUi(): boolean {
  return stack.length > 0 && stack.every((e) => e.silentUi);
}

export function isMaintenanceLocked(): boolean {
  return stack.length > 0;
}

/** Acquire lock; returns token for matching release (renderer). Main can ignore token and release LIFO. */
export function acquireMaintenanceLock(opts?: { silentUi?: boolean }): string {
  const token = randomBytes(8).toString('hex');
  const wasLocked = stack.length > 0;
  const prevSilent = currentSilentUi();
  stack.push({ token, silentUi: Boolean(opts?.silentUi) });
  const silent = currentSilentUi();
  if (!wasLocked || silent !== prevSilent) {
    broadcastMaintenance(true, silent);
  }
  return token;
}

/**
 * Release lock.
 * - With token: remove that entry (ignore unknown tokens).
 * - Without token: pop LIFO (internal main-process callers).
 */
export function releaseMaintenanceLock(token?: string): void {
  if (stack.length === 0) return;

  const prevSilent = currentSilentUi();
  if (typeof token === 'string' && token.trim()) {
    const idx = stack.findIndex((e) => e.token === token);
    if (idx === -1) return;
    stack.splice(idx, 1);
  } else {
    stack.pop();
  }

  if (stack.length === 0) {
    broadcastMaintenance(false, false);
    void import('./autoImportWatcher').then(({ resumeAutoImportIfNeeded }) => resumeAutoImportIfNeeded());
    return;
  }

  const silent = currentSilentUi();
  if (silent !== prevSilent) {
    broadcastMaintenance(true, silent);
  }
}

function broadcastMaintenance(locked: boolean, silent: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:maintenance', { locked, silentUi: silent });
    }
  }
}
