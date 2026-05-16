import { app, BrowserWindow, Menu, Tray } from 'electron';

import { loadAppIconImage } from './appIcon';

let tray: Tray | null = null;

function resolveMainWindow(): BrowserWindow | null {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return win && !win.isDestroyed() ? win : null;
}

export function showMainWindow(): void {
  const win = resolveMainWindow();
  if (!win) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

export function createAppTray(): Tray {
  const trayIcon = loadAppIconImage(16);
  tray = new Tray(trayIcon);
  tray.setToolTip('ARC');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть ARC',
      click: () => {
        showMainWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showMainWindow();
  });

  tray.on('double-click', () => {
    showMainWindow();
  });

  return tray;
}

export function destroyAppTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
