import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'path';

import { sanitizeEyedropperHex } from './colorEyedropperHex';
import { captureAllDisplays } from './screenshotCapture';
import { destroyScreenshotOverlay } from './screenshotOverlay';
import { destroyScreenshotWindowPicker } from './screenshotWindowPicker';

export type ColorEyedropperResult =
  | { action: 'pick'; hex: string }
  | { action: 'cancel' }
  | { action: 'error'; error: string };

type FramePayload = {
  dataUrl: string;
  scaleFactor: number;
};

let overlayWins: BrowserWindow[] = [];
let framesByWebContents = new Map<number, FramePayload>();
let resolvePicker: ((result: ColorEyedropperResult) => void) | null = null;
let ipcRegistered = false;
/** Растёт при старте и при destroy — отменяет незавершённый captureAllDisplays. */
let sessionGeneration = 0;

function preloadPath(): string {
  return path.resolve(__dirname, '..', 'preload', 'index.js');
}

function pickerPageUrl(): string {
  const dev = process.env.NODE_ENV === 'development';
  if (dev) return 'http://localhost:5173/color-eyedropper.html';
  return path.join(__dirname, '..', 'renderer', 'dist', 'color-eyedropper.html');
}

function closeOverlayWindows(): void {
  const wins = overlayWins.slice();
  overlayWins = [];
  framesByWebContents = new Map();
  for (const win of wins) {
    win.removeAllListeners('closed');
    win.removeAllListeners('ready-to-show');
  }
  setImmediate(() => {
    for (const win of wins) {
      if (!win.isDestroyed()) win.destroy();
    }
  });
}

function finishPicker(result: ColorEyedropperResult): void {
  const resolve = resolvePicker;
  resolvePicker = null;
  resolve?.(result);
  closeOverlayWindows();
}

export function destroyColorEyedropper(): void {
  sessionGeneration += 1;
  if (!resolvePicker && overlayWins.length === 0) return;
  finishPicker({ action: 'cancel' });
}

export function registerColorEyedropperIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:color-eyedropper-start', async () => {
    destroyScreenshotOverlay();
    destroyScreenshotWindowPicker();
    if (resolvePicker) {
      finishPicker({ action: 'cancel' });
    }

    const generation = ++sessionGeneration;
    let frames: Awaited<ReturnType<typeof captureAllDisplays>>;
    try {
      frames = await captureAllDisplays();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось снять экран';
      return { ok: false as const, error: message };
    }

    if (generation !== sessionGeneration) {
      return { ok: false as const, cancelled: true as const };
    }

    if (frames.length === 0) {
      return { ok: false as const, error: 'Не удалось снять экран' };
    }

    const result = await new Promise<ColorEyedropperResult>((resolve) => {
      resolvePicker = resolve;

      for (const frame of frames) {
        const win = new BrowserWindow({
          title: 'ARC color eyedropper',
          x: frame.bounds.x,
          y: frame.bounds.y,
          width: frame.bounds.width,
          height: frame.bounds.height,
          frame: false,
          transparent: false,
          backgroundColor: '#000000',
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
          enableLargerThanScreen: true,
          ...(process.platform === 'win32' ? { roundedCorners: false as const } : {}),
          webPreferences: {
            preload: preloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
          }
        });

        overlayWins.push(win);
        const contentsId = win.webContents.id;
        framesByWebContents.set(contentsId, {
          dataUrl: `data:image/png;base64,${frame.buffer.toString('base64')}`,
          scaleFactor: frame.scaleFactor
        });

        win.on('closed', () => {
          overlayWins = overlayWins.filter((w) => w !== win);
          framesByWebContents.delete(contentsId);
          if (overlayWins.length === 0 && resolvePicker) {
            const pending = resolvePicker;
            resolvePicker = null;
            pending({ action: 'cancel' });
          }
        });

        win.once('ready-to-show', () => {
          if (win.isDestroyed()) return;
          win.setAlwaysOnTop(true, 'screen-saver');
          win.show();
          win.focus();
        });

        const url = pickerPageUrl();
        if (url.startsWith('http')) {
          void win.loadURL(url);
        } else {
          void win.loadFile(url);
        }
      }
    });

    if (result.action === 'pick') {
      return { ok: true as const, hex: result.hex };
    }
    if (result.action === 'error') {
      return { ok: false as const, error: result.error };
    }
    return { ok: false as const, cancelled: true as const };
  });

  ipcMain.handle('arc:color-eyedropper-get-frame', (event: IpcMainInvokeEvent) => {
    const frame = framesByWebContents.get(event.sender.id);
    if (!frame) return { ok: false as const };
    return { ok: true as const, dataUrl: frame.dataUrl, scaleFactor: frame.scaleFactor };
  });

  ipcMain.handle('arc:color-eyedropper-confirm', (_event, hex: unknown) => {
    const sanitized = sanitizeEyedropperHex(hex);
    if (!sanitized) {
      finishPicker({ action: 'cancel' });
      return { ok: false };
    }
    finishPicker({ action: 'pick', hex: sanitized });
    return { ok: true };
  });

  ipcMain.handle('arc:color-eyedropper-cancel', () => {
    finishPicker({ action: 'cancel' });
    return { ok: true };
  });
}
