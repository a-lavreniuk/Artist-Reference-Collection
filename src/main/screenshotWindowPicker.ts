import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';

import { getWindowAtPoint, shouldExcludeWindowAtPoint } from './screenshotWindowBounds';

export type ScreenshotWindowPickerResult =
  | { action: 'save'; windowTitle: string; nativeId?: number }
  | { action: 'cancel' };

let overlayWin: BrowserWindow | null = null;
let resolvePicker: ((result: ScreenshotWindowPickerResult) => void) | null = null;
let ipcRegistered = false;
let virtualBounds = { x: 0, y: 0, width: 0, height: 0 };

function preloadPath(): string {
  return path.resolve(__dirname, '..', 'preload', 'index.js');
}

function pickerPageUrl(): string {
  const dev = process.env.NODE_ENV === 'development';
  if (dev) return 'http://localhost:5173/screenshot-window-picker.html';
  return path.join(__dirname, '..', 'renderer', 'dist', 'screenshot-window-picker.html');
}

function getVirtualDesktopBounds(): { x: number; y: number; width: number; height: number } {
  const displays = screen.getAllDisplays();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of displays) {
    const b = d.bounds;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!Number.isFinite(minX)) {
    const primary = screen.getPrimaryDisplay().bounds;
    return { x: primary.x, y: primary.y, width: primary.width, height: primary.height };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function finishPicker(result: ScreenshotWindowPickerResult): void {
  const resolve = resolvePicker;
  resolvePicker = null;
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.destroy();
  }
  overlayWin = null;
  resolve?.(result);
}

function closeOverlayWindow(): void {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.destroy();
  }
  overlayWin = null;
}

function sanitizePoint(raw: unknown): { x: number; y: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const x = typeof p.x === 'number' ? p.x : NaN;
  const y = typeof p.y === 'number' ? p.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function registerScreenshotWindowPickerIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:screenshot-window-picker-at-point', (_event, point: unknown) => {
    const sanitized = sanitizePoint(point);
    if (!sanitized) return { ok: false as const, window: null };

    const screenX = virtualBounds.x + sanitized.x;
    const screenY = virtualBounds.y + sanitized.y;
    const win = getWindowAtPoint(screenX, screenY);
    if (!win || shouldExcludeWindowAtPoint(win)) {
      return { ok: true as const, window: null };
    }

    return {
      ok: true as const,
      window: {
        title: win.title,
        nativeId: win.nativeId,
        x: win.x - virtualBounds.x,
        y: win.y - virtualBounds.y,
        width: win.width,
        height: win.height
      }
    };
  });

  ipcMain.handle('arc:screenshot-window-picker-confirm', (_event, payload: unknown) => {
    const body =
      payload && typeof payload === 'object' ? (payload as { title?: unknown; nativeId?: unknown }) : null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const nativeId = typeof body?.nativeId === 'number' ? body.nativeId : undefined;
    if (!title) {
      finishPicker({ action: 'cancel' });
      return { ok: false };
    }
    finishPicker({ action: 'save', windowTitle: title, nativeId });
    return { ok: true };
  });

  ipcMain.handle('arc:screenshot-window-picker-cancel', () => {
    finishPicker({ action: 'cancel' });
    return { ok: true };
  });
}

export function openScreenshotWindowPicker(): Promise<ScreenshotWindowPickerResult> {
  if (resolvePicker) {
    finishPicker({ action: 'cancel' });
  }

  return new Promise((resolve) => {
    resolvePicker = resolve;
    virtualBounds = getVirtualDesktopBounds();

    const win = new BrowserWindow({
      title: 'ARC screenshot window picker',
      x: virtualBounds.x,
      y: virtualBounds.y,
      width: virtualBounds.width,
      height: virtualBounds.height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      show: false,
      focusable: true,
      ...(process.platform === 'win32' ? { roundedCorners: false as const } : {}),
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    overlayWin = win;

    win.on('closed', () => {
      if (overlayWin === win) {
        overlayWin = null;
      }
      if (resolvePicker) {
        const pending = resolvePicker;
        resolvePicker = null;
        pending({ action: 'cancel' });
      }
    });

    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
      }
    });

    const url = pickerPageUrl();
    if (url.startsWith('http')) {
      void win.loadURL(url);
    } else {
      void win.loadFile(url);
    }
  });
}

export function destroyScreenshotWindowPicker(): void {
  closeOverlayWindow();
  if (resolvePicker) {
    const pending = resolvePicker;
    resolvePicker = null;
    pending({ action: 'cancel' });
  }
}
