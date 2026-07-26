import { randomBytes } from 'crypto';

import { BrowserWindow } from 'electron';

type LockEntry = {
  token: string;
  silentUi: boolean;
  reason: string;
};

const stack: LockEntry[] = [];
const MAX_STACK = 16;

function currentSilentUi(): boolean {
  return stack.length > 0 && stack.every((e) => e.silentUi);
}

export function isMaintenanceLocked(): boolean {
  return stack.length > 0;
}

/**
 * Acquire lock; returns token for matching release (renderer).
 * Main can still release LIFO by calling without token (internal only).
 */
export function acquireMaintenanceLock(opts?: { silentUi?: boolean; reason?: string }): string {
  if (stack.length >= MAX_STACK) {
    throw new Error('Слишком много вложенных блокировок обслуживания');
  }
  const token = randomBytes(8).toString('hex');
  const wasLocked = stack.length > 0;
  const prevSilent = currentSilentUi();
  stack.push({
    token,
    silentUi: Boolean(opts?.silentUi),
    reason: typeof opts?.reason === 'string' && opts.reason.trim() ? opts.reason.trim().slice(0, 64) : 'main'
  });
  const silent = currentSilentUi();
  if (!wasLocked || silent !== prevSilent) {
    broadcastMaintenance(true, silent);
  }
  return token;
}

/**
 * Release lock.
 * - With token: remove that entry (ignore unknown tokens). Returns whether an entry was removed.
 * - Without token: pop LIFO (internal main-process callers only).
 */
export function releaseMaintenanceLock(token?: string): boolean {
  if (stack.length === 0) return false;

  const prevSilent = currentSilentUi();
  let removed = false;
  if (typeof token === 'string' && token.trim()) {
    const idx = stack.findIndex((e) => e.token === token);
    if (idx === -1) return false;
    stack.splice(idx, 1);
    removed = true;
  } else {
    stack.pop();
    removed = true;
  }

  if (stack.length === 0) {
    broadcastMaintenance(false, false);
    void import('./autoImportWatcher').then(({ resumeAutoImportIfNeeded }) => resumeAutoImportIfNeeded());
    return removed;
  }

  const silent = currentSilentUi();
  if (silent !== prevSilent) {
    broadcastMaintenance(true, silent);
  }
  return removed;
}

function broadcastMaintenance(locked: boolean, silent: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:maintenance', { locked, silentUi: silent });
    }
  }
}
