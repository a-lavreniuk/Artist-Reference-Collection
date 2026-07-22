import { BrowserWindow } from 'electron';

let depth = 0;
/** Когда true — lock активен, но полноэкранная плашка «Идёт операция…» не показывается. */
let silentUi = false;

export function isMaintenanceLocked(): boolean {
  return depth > 0;
}

export function acquireMaintenanceLock(opts?: { silentUi?: boolean }): void {
  depth += 1;
  if (opts?.silentUi) silentUi = true;
  if (depth === 1) {
    broadcastMaintenance(true, silentUi);
  }
}

export function releaseMaintenanceLock(): void {
  if (depth <= 0) return;
  depth -= 1;
  if (depth === 0) {
    silentUi = false;
    broadcastMaintenance(false, false);
    void import('./autoImportWatcher').then(({ resumeAutoImportIfNeeded }) => resumeAutoImportIfNeeded());
  }
}

function broadcastMaintenance(locked: boolean, silent: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:maintenance', { locked, silentUi: silent });
    }
  }
}
