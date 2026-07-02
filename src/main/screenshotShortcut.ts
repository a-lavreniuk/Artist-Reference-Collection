import { globalShortcut } from 'electron';

import { readAppPreferencesSync } from './appPreferences';
import { importScreenshotFromRegion } from './screenshotCapture';
import { openScreenshotAreaPicker } from './screenshotOverlay';
import { isScreenshotCaptureInFlight, setScreenshotCaptureInFlight } from './screenshotSession';
import { SCREENSHOT_ACCELERATOR } from './shared/shortcutAccelerators';
import { getMainWindow, showMainWindow } from './windowChrome';

let registered = false;

function restoreMainIfHidden(): void {
  const mainWin = getMainWindow();
  if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) {
    showMainWindow();
  }
}

async function onScreenshotHotkey(): Promise<void> {
  if (isScreenshotCaptureInFlight()) return;

  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return;

  setScreenshotCaptureInFlight(true);

  const mainWin = getMainWindow();
  const wasVisible = mainWin?.isVisible() ?? false;
  const wasMinimized = mainWin?.isMinimized() ?? false;

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.hide();
  }

  try {
    const pickerResult = await openScreenshotAreaPicker();

    if (pickerResult.action === 'cancel') {
      if (mainWin && !mainWin.isDestroyed() && (wasVisible || wasMinimized)) {
        showMainWindow();
      }
      return;
    }

    await importScreenshotFromRegion(pickerResult.region);
  } finally {
    setScreenshotCaptureInFlight(false);
    restoreMainIfHidden();
  }
}

export function registerScreenshotShortcut(): void {
  unregisterScreenshotShortcut();

  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return;

  if (
    !globalShortcut.register(SCREENSHOT_ACCELERATOR, () => {
      void onScreenshotHotkey();
    })
  ) {
    registered = false;
    return;
  }

  registered = true;
}

export function unregisterScreenshotShortcut(): void {
  if (registered) {
    globalShortcut.unregister(SCREENSHOT_ACCELERATOR);
    registered = false;
  }
}

export async function applyStoredScreenshotShortcut(): Promise<void> {
  registerScreenshotShortcut();
}
