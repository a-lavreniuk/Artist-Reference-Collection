import { globalShortcut } from 'electron';

import { readAppPreferencesSync } from './appPreferences';
import {
  importScreenshotFromFullscreen,
  importScreenshotFromRegion,
  importScreenshotFromWindow
} from './screenshotCapture';
import { openScreenshotAreaPicker } from './screenshotOverlay';
import {
  hideMainWindowForScreenshot,
  isScreenshotCaptureInFlight,
  restoreMainWindowAfterScreenshot,
  setScreenshotCaptureInFlight,
  snapshotMainWindowForScreenshot
} from './screenshotSession';
import { openScreenshotWindowPicker } from './screenshotWindowPicker';
import {
  SCREENSHOT_AREA_ACCELERATOR,
  SCREENSHOT_FULLSCREEN_ACCELERATOR,
  SCREENSHOT_FULLSCREEN_PRTSCR_ACCELERATOR,
  SCREENSHOT_WINDOW_ACCELERATOR,
  SCREENSHOT_WINDOW_ALT_PRTSCR_ACCELERATOR
} from './shared/shortcutAccelerators';

const registeredAccelerators = new Set<string>();

type ScreenshotMode = 'area' | 'fullscreen' | 'window';

function tryRegister(accelerator: string, handler: () => void): boolean {
  if (registeredAccelerators.has(accelerator)) return true;
  if (!globalShortcut.register(accelerator, handler)) return false;
  registeredAccelerators.add(accelerator);
  return true;
}

function unregisterAll(): void {
  for (const accelerator of registeredAccelerators) {
    globalShortcut.unregister(accelerator);
  }
  registeredAccelerators.clear();
}

async function withScreenshotSession(run: () => Promise<void>): Promise<void> {
  if (isScreenshotCaptureInFlight()) return;

  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return;

  setScreenshotCaptureInFlight(true);
  const snapshot = snapshotMainWindowForScreenshot();
  hideMainWindowForScreenshot(snapshot);

  try {
    await run();
  } finally {
    setScreenshotCaptureInFlight(false);
    restoreMainWindowAfterScreenshot(snapshot);
  }
}

async function onScreenshotMode(mode: ScreenshotMode): Promise<void> {
  await withScreenshotSession(async () => {
    if (mode === 'area') {
      const pickerResult = await openScreenshotAreaPicker();
      if (pickerResult.action === 'cancel') return;
      await importScreenshotFromRegion(pickerResult.region);
      return;
    }

    if (mode === 'fullscreen') {
      await importScreenshotFromFullscreen();
      return;
    }

    const pickerResult = await openScreenshotWindowPicker();
    if (pickerResult.action === 'cancel') return;
    await importScreenshotFromWindow(pickerResult.windowTitle, pickerResult.nativeId);
  });
}

export function registerScreenshotShortcuts(): void {
  unregisterScreenshotShortcuts();

  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return;

  const areaHandler = () => {
    void onScreenshotMode('area');
  };
  const fullscreenHandler = () => {
    void onScreenshotMode('fullscreen');
  };
  const windowHandler = () => {
    void onScreenshotMode('window');
  };

  tryRegister(SCREENSHOT_AREA_ACCELERATOR, areaHandler);
  tryRegister(SCREENSHOT_FULLSCREEN_ACCELERATOR, fullscreenHandler);
  tryRegister(SCREENSHOT_WINDOW_ACCELERATOR, windowHandler);

  if (process.platform === 'win32') {
    tryRegister(SCREENSHOT_FULLSCREEN_PRTSCR_ACCELERATOR, fullscreenHandler);
    tryRegister(SCREENSHOT_WINDOW_ALT_PRTSCR_ACCELERATOR, windowHandler);
  }
}

export function unregisterScreenshotShortcuts(): void {
  unregisterAll();
}

export async function applyStoredScreenshotShortcut(): Promise<void> {
  registerScreenshotShortcuts();
}

/** @deprecated Use registerScreenshotShortcuts */
export function registerScreenshotShortcut(): void {
  registerScreenshotShortcuts();
}

/** @deprecated Use unregisterScreenshotShortcuts */
export function unregisterScreenshotShortcut(): void {
  unregisterScreenshotShortcuts();
}
