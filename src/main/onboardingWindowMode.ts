import { BrowserWindow, ipcMain } from 'electron';

import { forceWebContentsLayoutSync, getMainWindow } from './windowChrome';
import { WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from './windowSize';

/** Синхрон с renderer/src/content/onboarding.ts */
export const ONBOARDING_WINDOW_WIDTH = 1280;
export const ONBOARDING_WINDOW_HEIGHT = 800;

const MAIN_WINDOW_BG = '#1a1a1e';

function setWindowRoundedCorners(win: BrowserWindow, rounded: boolean): void {
  if (process.platform !== 'win32') return;
  const w = win as BrowserWindow & { setRoundedCorners?: (rounded: boolean) => void };
  w.setRoundedCorners?.(rounded);
}

export function needsOnboardingSetup(libraryRoot: string | null, _onboardingSetupCompleted: boolean): boolean {
  return !libraryRoot;
}

export function applyMainWindowOnboardingMode(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (win.isMaximized()) win.unmaximize();
  if (win.isFullScreen()) win.setFullScreen(false);
  win.setResizable(false);
  win.setMinimumSize(ONBOARDING_WINDOW_WIDTH, ONBOARDING_WINDOW_HEIGHT);
  win.setMaximumSize(ONBOARDING_WINDOW_WIDTH, ONBOARDING_WINDOW_HEIGHT);
  win.setSize(ONBOARDING_WINDOW_WIDTH, ONBOARDING_WINDOW_HEIGHT);
  win.center();
  setWindowRoundedCorners(win, true);
  win.setBackgroundColor(MAIN_WINDOW_BG);
}

export function restoreMainWindowAfterOnboarding(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.setResizable(true);
  win.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
  win.setMaximumSize(0, 0);
  setWindowRoundedCorners(win, false);
  win.setBackgroundColor(MAIN_WINDOW_BG);
  if (!win.isMaximized()) win.maximize();
  forceWebContentsLayoutSync(win);
}

let ipcRegistered = false;

export function registerOnboardingWindowModeIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:set-main-window-onboarding-mode', (_event, enabled: unknown) => {
    const win = getMainWindow();
    if (!win || typeof enabled !== 'boolean') return { ok: false };
    if (enabled) applyMainWindowOnboardingMode(win);
    else restoreMainWindowAfterOnboarding(win);
    return { ok: true };
  });
}
