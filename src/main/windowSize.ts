import { BrowserWindow, screen } from 'electron';

export const WINDOW_MIN_WIDTH = 1440;
export const WINDOW_MIN_HEIGHT = 900;

export type WindowSize = { width: number; height: number };

let sessionCustomSize: WindowSize | null = null;

export function clearSessionWindowSize(): void {
  sessionCustomSize = null;
}

export function setSessionWindowSize(width: number, height: number): void {
  sessionCustomSize = clampWindowSize(width, height);
}

export function getSessionWindowSize(): WindowSize | null {
  return sessionCustomSize;
}

export function clampWindowSize(
  width: number,
  height: number,
  workArea?: { width: number; height: number }
): WindowSize {
  let w = Math.max(WINDOW_MIN_WIDTH, Math.round(width));
  let h = Math.max(WINDOW_MIN_HEIGHT, Math.round(height));

  if (workArea) {
    w = Math.min(w, Math.max(WINDOW_MIN_WIDTH, workArea.width));
    h = Math.min(h, Math.max(WINDOW_MIN_HEIGHT, workArea.height));
  }

  return { width: w, height: h };
}

export function applySessionWindowSize(win: BrowserWindow): void {
  const size = getSessionWindowSize();
  if (!size) return;

  const display = screen.getDisplayMatching(win.getBounds());
  const clamped = clampWindowSize(size.width, size.height, display.workAreaSize);

  if (win.isMaximized()) {
    win.unmaximize();
  }

  win.setSize(clamped.width, clamped.height);
}
