import { app, BrowserWindow, ipcMain, screen } from 'electron';

import { getCloseToTrayOnWindowClose } from './appPreferences';
import { isScreenshotCaptureInFlight } from './screenshotSession';
import {
  applySessionWindowSize,
  getSessionWindowSize,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH
} from './windowSize';

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

/** На darwin nudge/setContentSize ломает frameless maximize — не трогаем maximized. */
export function shouldApplyDarwinLayoutNudge(isMaximized: boolean): boolean {
  return !isMaximized;
}

export type RectLike = { x: number; y: number; width: number; height: number };

/** Сравнение bounds с work area (fallback maximize без isMaximized). */
export function boundsMatchWorkArea(bounds: RectLike, workArea: RectLike, tolerance = 2): boolean {
  return (
    Math.abs(bounds.x - workArea.x) <= tolerance &&
    Math.abs(bounds.y - workArea.y) <= tolerance &&
    Math.abs(bounds.width - workArea.width) <= tolerance &&
    Math.abs(bounds.height - workArea.height) <= tolerance
  );
}

/**
 * Windowed-размер после darwin work-area fallback: всегда меньше work area,
 * иначе «Развернуть» снова считает окно maximized.
 */
export function windowedBoundsInWorkArea(workArea: RectLike): RectLike {
  const inset = 48;
  const maxW = Math.max(1, workArea.width - inset);
  const maxH = Math.max(1, workArea.height - inset);
  const width = Math.min(WINDOW_MIN_WIDTH, maxW);
  const height = Math.min(WINDOW_MIN_HEIGHT, maxH);
  return {
    x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
    width,
    height
  };
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

  if (process.platform === 'darwin' && !shouldApplyDarwinLayoutNudge(isMainWindowMaximized(win))) {
    return;
  }

  const [width, height] = win.getContentSize();
  if (width < 1 || height < 1) return;
  win.setContentSize(width, height);

  if (process.platform === 'darwin') {
    nudgeWindowBoundsOnDarwin(win);
    setTimeout(() => {
      if (win.isDestroyed()) return;
      if (!shouldApplyDarwinLayoutNudge(isMainWindowMaximized(win))) return;
      const [w, h] = win.getContentSize();
      if (w < 1 || h < 1) return;
      win.setContentSize(w, h);
    }, 0);
  }
}

/** Maximized native или darwin work-area fallback. */
export function isMainWindowMaximized(win: BrowserWindow): boolean {
  if (win.isDestroyed()) return false;
  if (win.isMaximized()) return true;
  if (process.platform !== 'darwin') return false;
  const bounds = win.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  return boundsMatchWorkArea(bounds, workArea);
}

/** Maximize: на darwin — maximize() с fallback на workArea (frameless). */
export function maximizeMainWindow(win: BrowserWindow): void {
  if (win.isDestroyed() || !win.isResizable()) return;
  if (isMainWindowMaximized(win)) return;

  if (process.platform === 'darwin') {
    win.maximize();
    if (!win.isMaximized()) {
      const workArea = screen.getDisplayMatching(win.getBounds()).workArea;
      win.setBounds(workArea);
    }
    return;
  }

  win.maximize();
}

export function unmaximizeMainWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;

  if (win.isMaximized()) {
    win.unmaximize();
    return;
  }

  if (process.platform === 'darwin' && isMainWindowMaximized(win)) {
    const workArea = screen.getDisplayMatching(win.getBounds()).workArea;
    const session = getSessionWindowSize();
    if (session && !boundsMatchWorkArea({ ...session, x: workArea.x, y: workArea.y }, workArea)) {
      applySessionWindowSize(win);
      if (!isMainWindowMaximized(win)) return;
    }
    win.setBounds(windowedBoundsInWorkArea(workArea));
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
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  return null;
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

  if (maximize && win.isResizable() && !isMainWindowMaximized(win)) {
    maximizeMainWindow(win);
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

/** После скриншота / отмены overlay — maximize как при показе из трея, иначе layout ломается. */
export function showMainWindowAfterScreenshot(): void {
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
    if (isMainWindowMaximized(win)) {
      unmaximizeMainWindow(win);
    } else {
      maximizeMainWindow(win);
    }
    scheduleWebContentsLayoutSync(win);
    return { ok: true, maximized: isMainWindowMaximized(win) };
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
