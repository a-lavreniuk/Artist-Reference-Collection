import { app, BrowserWindow, Menu, nativeTheme, protocol } from 'electron';
import path from 'path';

import { appIconPath } from './appIcon';
import { registerDevToolsShortcuts, toggleDevTools, unregisterDevToolsShortcuts } from './devTools';
import { registerArcIpc, registerArcMediaProtocol } from './ipc';
import { createAppTray, destroyAppTray } from './tray';
import { bindFileDropGuards } from './fileDropGuards';
import { bindMainWindow, isAppQuitting, registerWindowChromeIpc } from './windowChrome';
import { initArcUpdater, registerArcUpdaterIpc } from './updater';
import {
  clearSessionWindowSize,
  setSessionWindowSize,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH
} from './windowSize';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'arc-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function createWindow(): BrowserWindow {
  const preloadPath = path.resolve(__dirname, '..', 'preload', 'index.js');
  const iconPath = appIconPath();

  const win = new BrowserWindow({
    width: WINDOW_MIN_WIDTH,
    height: WINDOW_MIN_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: '#1a1a1e',
    ...(process.platform === 'win32' ? { roundedCorners: false as const } : {}),
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
    win.maximize();
    win.show();
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
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '..', 'renderer', 'dist', 'index.html');
    void win.loadFile(indexHtml);
  }

  return win;
}

app.on('web-contents-created', (_event, contents) => {
  bindFileDropGuards(contents);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = 'system';

  clearSessionWindowSize();

  registerArcMediaProtocol();
  registerArcIpc();
  registerWindowChromeIpc();
  registerArcUpdaterIpc();
  registerDevToolsShortcuts();
  createWindow();
  createAppTray();
  initArcUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (isAppQuitting()) return;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  destroyAppTray();
  unregisterDevToolsShortcuts();
});
