import { app, BrowserWindow, Menu, nativeTheme, protocol } from 'electron';
import path from 'path';

import { iconLightPath } from './appIcon';
import { registerDevToolsShortcuts, toggleDevTools, unregisterDevToolsShortcuts } from './devTools';
import { registerArcIpc, registerArcMediaProtocol } from './ipc';
import { createAppTray, destroyAppTray } from './tray';
import { initArcUpdater, registerArcUpdaterIpc } from './updater';

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
  const iconPath = iconLightPath();

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once('ready-to-show', () => {
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = 'system';

  registerArcMediaProtocol();
  registerArcIpc();
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  destroyAppTray();
  unregisterDevToolsShortcuts();
});
