import { BrowserWindow } from 'electron';

let depth = 0;

export function isMaintenanceLocked(): boolean {
  return depth > 0;
}

export function acquireMaintenanceLock(): void {
  depth += 1;
  if (depth === 1) {
    broadcastMaintenance(true);
  }
}

export function releaseMaintenanceLock(): void {
  if (depth <= 0) return;
  depth -= 1;
  if (depth === 0) {
    broadcastMaintenance(false);
    void import('./autoImportWatcher').then(({ resumeAutoImportIfNeeded }) => resumeAutoImportIfNeeded());
  }
}

function broadcastMaintenance(locked: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:maintenance', { locked });
    }
  }
}
