import type { BrowserWindow } from 'electron';

import { getMainWindow, showMainWindowAfterScreenshot } from './windowChrome';

export type MainWindowSnapshot = {
  win: BrowserWindow | null;
  wasVisible: boolean;
  wasMinimized: boolean;
};

let captureInFlight = false;

export function setScreenshotCaptureInFlight(inFlight: boolean): void {
  captureInFlight = inFlight;
}

export function isScreenshotCaptureInFlight(): boolean {
  return captureInFlight;
}

export function snapshotMainWindowForScreenshot(): MainWindowSnapshot {
  const win = getMainWindow();
  return {
    win,
    wasVisible: win?.isVisible() ?? false,
    wasMinimized: win?.isMinimized() ?? false
  };
}

export function hideMainWindowForScreenshot(snapshot: MainWindowSnapshot): void {
  const { win } = snapshot;
  if (win && !win.isDestroyed()) {
    win.hide();
  }
}

export function restoreMainWindowAfterScreenshot(snapshot: MainWindowSnapshot): void {
  const { win, wasVisible, wasMinimized } = snapshot;
  if (win && !win.isDestroyed() && (wasVisible || wasMinimized)) {
    showMainWindowAfterScreenshot();
  }
}
