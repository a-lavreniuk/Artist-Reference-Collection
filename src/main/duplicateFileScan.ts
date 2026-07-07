import { registerDuplicateIpc, triggerDuplicateScanAfterImport } from './ipcDuplicates';

let legacyRegistered = false;

/** @deprecated Use registerDuplicateIpc from ipcDuplicates */
export function registerDuplicateScanIpc(): void {
  if (legacyRegistered) return;
  legacyRegistered = true;
}

export { registerDuplicateIpc, triggerDuplicateScanAfterImport };

export async function scanForDuplicateFiles(): Promise<boolean> {
  const { scanForDuplicateFilesAfterImport } = await import('./duplicateScanService');
  const found = await scanForDuplicateFilesAfterImport();
  if (found) {
    const { BrowserWindow } = await import('electron');
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('arc:duplicates-found', {});
      }
    }
  }
  return found;
}
