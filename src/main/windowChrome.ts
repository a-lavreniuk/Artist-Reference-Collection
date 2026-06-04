import { BrowserWindow, ipcMain } from 'electron';

let mainWindowRef: BrowserWindow | null = null;
let appQuitting = false;

export function setAppQuitting(): void {
  appQuitting = true;
}

export function isAppQuitting(): boolean {
  return appQuitting;
}

export function bindMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
  win.on('closed', () => {
    if (mainWindowRef === win) {
      mainWindowRef = null;
    }
  });

  win.on('close', (event) => {
    if (appQuitting) return;
    event.preventDefault();
    win.hide();
  });
}

function resolveTargetWindow(): BrowserWindow | null {
  const win = mainWindowRef;
  if (win && !win.isDestroyed()) return win;
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export function registerWindowChromeIpc(): void {
  ipcMain.handle('arc:window-minimize-to-tray', () => {
    const win = resolveTargetWindow();
    if (!win) return { ok: false };
    win.hide();
    return { ok: true };
  });

  ipcMain.handle('arc:window-toggle-maximize', () => {
    const win = resolveTargetWindow();
    if (!win) return { ok: false };
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return { ok: true, maximized: win.isMaximized() };
  });

  ipcMain.handle('arc:window-close-to-tray', () => {
    const win = resolveTargetWindow();
    if (!win) return { ok: false };
    win.hide();
    return { ok: true };
  });
}
