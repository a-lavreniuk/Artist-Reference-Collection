import { app, BrowserWindow, Menu, nativeTheme } from 'electron';
import path from 'path';

import { configureAppProfile } from './appProfile';
import {
  bindDeepLinkSingleInstance,
  consumePendingDeepLink,
  registerArcProtocolClient
} from './deepLink';

configureAppProfile();
registerArcProtocolClient();
if (!bindDeepLinkSingleInstance()) {
  process.exit(0);
}

import { appIconPath } from './appIcon';
import { registerDevToolsShortcuts, toggleDevTools, unregisterDevToolsShortcuts } from './devTools';
import { registerArcIpc } from './ipc';
import { readLibraryRootSync, reconcileLibraryRootConfig } from './libraryRootConfig';
import { refreshBrandingIconIfNeeded } from './libraryFolderIcon';
import { refreshLibrarySessionSnapshotFromDisk } from './librarySessionSnapshot';
import { shutdownArcMediaServer, startArcMediaServer } from './media/mediaServerHost';
import { startImportApiServer, stopImportApiServer } from './importApi/importApiHost';
import { createAppTray, destroyAppTray } from './tray';
import { bindFileDropGuards } from './fileDropGuards';
import { applyStoredLaunchAtLogin, readAppPreferences, registerAppPreferencesIpc, shouldStartHiddenInTray } from './appPreferences';
import { registerAutoImportIpc, restartAutoImportWatcher } from './autoImportWatcher';
import { applyStoredScreenshotShortcut, unregisterScreenshotShortcut } from './screenshotShortcut';
import { applyStoredFeedbackShortcut, registerFeedbackIpc, unregisterFeedbackShortcut } from './feedbackShortcut';
import { registerScreenshotIpc } from './screenshotCapture';
import { destroyScreenshotOverlay, registerScreenshotPickerIpc } from './screenshotOverlay';
import { registerDuplicateScanIpc } from './duplicateFileScan';
import { bindMainWindow, registerWindowChromeIpc } from './windowChrome';
import {
  needsOnboardingSetup,
  ONBOARDING_WINDOW_HEIGHT,
  ONBOARDING_WINDOW_WIDTH,
  registerOnboardingWindowModeIpc
} from './onboardingWindowMode';
import {
  destroyLoadingSplash,
  markMainWindowReadyToShow,
  prepareStartupWithoutSplash,
  registerLoadingSplashIpc,
  runLoadingSplashAtStartup,
  setLoadingSplashMilestone,
  setStartHiddenInTray,
  waitForLoadingBootstrapComplete
} from './loadingSplash';
import { initArcUpdater, registerArcUpdaterIpc } from './updater';
import { registerAiIpc, scheduleIdleIndexing, shutdownAiWorker } from './ipcAi';
import {
  clearSessionWindowSize,
  setSessionWindowSize,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH
} from './windowSize';

function createWindow(onboardingMode = false): BrowserWindow {
  const preloadPath = path.resolve(__dirname, '..', 'preload', 'index.js');
  const iconPath = appIconPath();

  const win = new BrowserWindow({
    width: onboardingMode ? ONBOARDING_WINDOW_WIDTH : WINDOW_MIN_WIDTH,
    height: onboardingMode ? ONBOARDING_WINDOW_HEIGHT : WINDOW_MIN_HEIGHT,
    minWidth: onboardingMode ? ONBOARDING_WINDOW_WIDTH : WINDOW_MIN_WIDTH,
    minHeight: onboardingMode ? ONBOARDING_WINDOW_HEIGHT : WINDOW_MIN_HEIGHT,
    maxWidth: onboardingMode ? ONBOARDING_WINDOW_WIDTH : undefined,
    maxHeight: onboardingMode ? ONBOARDING_WINDOW_HEIGHT : undefined,
    resizable: !onboardingMode,
    show: false,
    frame: false,
    backgroundColor: '#1a1a1e',
    ...(process.platform === 'win32' ? { roundedCorners: onboardingMode } : {}),
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  win.setBackgroundColor('#1a1a1e');
  bindMainWindow(win);

  let resizeSaveTimer: ReturnType<typeof setTimeout> | null = null;

  win.on('resize', () => {
    if (win.isMaximized()) return;
    if (resizeSaveTimer) clearTimeout(resizeSaveTimer);
    resizeSaveTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isMaximized()) return;
      const [width, height] = win.getSize();
      setSessionWindowSize(width, height);
    }, 300);
  });

  win.once('ready-to-show', () => {
    markMainWindowReadyToShow(win, onboardingMode);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const openInspector =
      key === 'f12' || (input.control && input.shift && (key === 'i' || input.code === 'KeyI'));
    if (openInspector) {
      toggleDevTools();
      event.preventDefault();
    }
  });

  const dev = process.env.NODE_ENV === 'development';

  if (dev) {
    void win.loadURL('http://localhost:5173');
  } else {
    const indexHtml = path.join(__dirname, '..', 'renderer', 'dist', 'index.html');
    void win.loadFile(indexHtml);
  }

  return win;
}

app.on('web-contents-created', (_event, contents) => {
  bindFileDropGuards(contents);
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = 'system';

  try {
    await startImportApiServer();
  } catch (err) {
    console.error('[ARC Import API] failed to start:', err);
  }

  clearSessionWindowSize();
  registerLoadingSplashIpc();

  const prefsEarly = await readAppPreferences();
  const needsSetupEarly = needsOnboardingSetup(readLibraryRootSync(), prefsEarly.onboardingSetupCompleted);
  const startHiddenInTray = shouldStartHiddenInTray(prefsEarly, needsSetupEarly);

  if (startHiddenInTray) {
    setStartHiddenInTray(true);
    await prepareStartupWithoutSplash();
  } else {
    await runLoadingSplashAtStartup();
  }

  if (!startHiddenInTray) {
    setLoadingSplashMilestone(0, 'Запуск приложения…');
  }

  setLoadingSplashMilestone(15, 'Инициализация модулей…');
  await reconcileLibraryRootConfig();
  await startArcMediaServer(readLibraryRootSync());
  await refreshBrandingIconIfNeeded();
  registerArcIpc();
  registerAppPreferencesIpc();
  registerWindowChromeIpc();
  registerScreenshotIpc();
  registerScreenshotPickerIpc();
  registerOnboardingWindowModeIpc();
  registerFeedbackIpc();
  registerDuplicateScanIpc();
  registerAutoImportIpc();
  void applyStoredLaunchAtLogin();
  void applyStoredScreenshotShortcut();
  applyStoredFeedbackShortcut();
  void readAppPreferences().then((loadedPrefs) => {
    restartAutoImportWatcher();
    if (loadedPrefs.aiSemanticSearchEnabled) scheduleIdleIndexing();
  });
  registerArcUpdaterIpc();
  registerAiIpc();
  registerDevToolsShortcuts();

  setLoadingSplashMilestone(35, 'Загрузка интерфейса…');
  const prefs = await readAppPreferences();
  const needsSetup = needsOnboardingSetup(readLibraryRootSync(), prefs.onboardingSetupCompleted);
  const mainWin = createWindow(needsSetup);
  mainWin.webContents.once('did-finish-load', () => {
    setLoadingSplashMilestone(55, 'Подготовка данных…');
  });
  void waitForLoadingBootstrapComplete();

  createAppTray();
  initArcUpdater();
  consumePendingDeepLink();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void refreshLibrarySessionSnapshotFromDisk();
  shutdownArcMediaServer();
  stopImportApiServer();
  destroyAppTray();
  unregisterDevToolsShortcuts();
  unregisterScreenshotShortcut();
  unregisterFeedbackShortcut();
  destroyScreenshotOverlay();
  destroyLoadingSplash();
  shutdownAiWorker();
  void import('./autoImportWatcher').then(({ stopAutoImportWatcher }) => stopAutoImportWatcher());
});
