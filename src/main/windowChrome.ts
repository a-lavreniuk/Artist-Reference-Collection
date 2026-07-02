import { app, BrowserWindow, ipcMain } from 'electron';

import { getCloseToTrayOnWindowClose } from './appPreferences';
import { isScreenshotCaptureInFlight } from './screenshotSession';
import { applySessionWindowSize, getSessionWindowSize } from './windowSize';

let mainWindowRef: BrowserWindow | null = null;
let appQuitting = false;

export function setAppQuitting(): void {
  appQuitting = true;
}

export function isAppQuitting(): boolean {
  return appQuitting;
}

/** Maximize при показе только в обычном режиме (не onboarding). */
export function shouldMaximizeOnShow(isResizable: boolean): boolean {
  return isResizable;
}

function nudgeWindowBoundsOnDarwin(win: BrowserWindow): void {
  if (process.platform !== 'darwin') return;
  const bounds = win.getBounds();
  if (bounds.width < 1 || bounds.height < 1) return;
  win.setBounds({ ...bounds, width: bounds.width + 1 });
  win.setBounds(bounds);
}

function scheduleWebContentsLayoutSync(win: BrowserWindow): void {
  setImmediate(() => forceWebContentsLayoutSync(win));
  if (process.platform === 'darwin') {
    setTimeout(() => forceWebContentsLayoutSync(win), 16);
  }
}

/** После hide/show или unmaximize Chromium может не обновить viewport — клики и layout «уезжают». */
export function forceWebContentsLayoutSync(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc || wc.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  if (width < 1 || height < 1) return;
  win.setContentSize(width, height);

  if (process.platform === 'darwin') {
    nudgeWindowBoundsOnDarwin(win);
    setTimeout(() => {
      if (win.isDestroyed()) return;
      const [w, h] = win.getContentSize();
      if (w < 1 || h < 1) return;
      win.setContentSize(w, h);
    }, 0);
  }
}

export function bindMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
  win.on('closed', () => {
    if (mainWindowRef === win) {
      mainWindowRef = null;
    }
  });

  win.on('show', () => scheduleWebContentsLayoutSync(win));
  win.on('maximize', () => scheduleWebContentsLayoutSync(win));
  win.on('unmaximize', () => scheduleWebContentsLayoutSync(win));
  win.on('restore', () => scheduleWebContentsLayoutSync(win));

  win.on('close', (event) => {
    if (appQuitting) return;
    if (!getCloseToTrayOnWindowClose()) {
      setAppQuitting();
      return;
    }
    event.preventDefault();
    win.hide();
  });
}

function resolveTargetWindow(): BrowserWindow | null {
  const win = mainWindowRef;
  if (win && !win.isDestroyed()) return win;
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export function getMainWindow(): BrowserWindow | null {
  return resolveTargetWindow();
}

export type ShowMainWindowOptions = {
  /** При показе из трея — всегда на весь экран, без восстановления windowed-размера. */
  maximize?: boolean;
};

export function showMainWindow(options?: ShowMainWindowOptions): void {
  const win = resolveTargetWindow();
  if (!win) return;

  const maximize = options?.maximize === true;

  if (!maximize && getSessionWindowSize()) {
    applySessionWindowSize(win);
  }

  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();

  if (maximize && win.isResizable() && !win.isMaximized()) {
    win.maximize();
  }

  scheduleWebContentsLayoutSync(win);
  win.focus();
}

/** Показ окна по действию пользователя (Dock, трей, deep link) с учётом onboarding. */
export function showMainWindowFromUserAction(): void {
  if (isScreenshotCaptureInFlight()) return;
  const win = resolveTargetWindow();
  if (!win) return;
  showMainWindow({ maximize: shouldMaximizeOnShow(win.isResizable()) });
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
    scheduleWebContentsLayoutSync(win);
    return { ok: true, maximized: win.isMaximized() };
  });

  ipcMain.handle('arc:window-close-to-tray', () => {
    const win = resolveTargetWindow();
    if (!win) return { ok: false };
    if (getCloseToTrayOnWindowClose()) {
      win.hide();
      return { ok: true };
    }
    setAppQuitting();
    win.close();
    if (BrowserWindow.getAllWindows().length === 0) {
      app.quit();
    }
    return { ok: true };
  });
}
