import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';

export type ScreenshotRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenshotPickerResult =
  | { action: 'save'; region: ScreenshotRegion }
  | { action: 'cancel' };

let overlayWin: BrowserWindow | null = null;
let resolvePicker: ((result: ScreenshotPickerResult) => void) | null = null;
let ipcRegistered = false;

function preloadPath(): string {
  return path.resolve(__dirname, '..', 'preload', 'index.js');
}

function pickerPageUrl(): string {
  const dev = process.env.NODE_ENV === 'development';
  if (dev) return 'http://localhost:5173/screenshot-picker.html';
  return path.join(__dirname, '..', 'renderer', 'dist', 'screenshot-picker.html');
}

function sanitizeRegion(raw: unknown): ScreenshotRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const x = typeof r.x === 'number' ? r.x : NaN;
  const y = typeof r.y === 'number' ? r.y : NaN;
  const width = typeof r.width === 'number' ? r.width : NaN;
  const height = typeof r.height === 'number' ? r.height : NaN;
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

function finishPicker(result: ScreenshotPickerResult): void {
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

export function registerScreenshotPickerIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:screenshot-picker-confirm', (_event, region: unknown) => {
    const sanitized = sanitizeRegion(region);
    if (!sanitized) {
      finishPicker({ action: 'cancel' });
      return { ok: false };
    }
    finishPicker({ action: 'save', region: sanitized });
    return { ok: true };
  });

  ipcMain.handle('arc:screenshot-picker-cancel', () => {
    finishPicker({ action: 'cancel' });
    return { ok: true };
  });
}

export function openScreenshotAreaPicker(): Promise<ScreenshotPickerResult> {
  if (resolvePicker) {
    finishPicker({ action: 'cancel' });
  }

  return new Promise((resolve) => {
    resolvePicker = resolve;

    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
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

export function destroyScreenshotOverlay(): void {
  closeOverlayWindow();
  if (resolvePicker) {
    const pending = resolvePicker;
    resolvePicker = null;
    pending({ action: 'cancel' });
  }
}
