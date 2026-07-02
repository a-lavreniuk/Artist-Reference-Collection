import { app, Menu, Tray } from 'electron';

import { setAppQuitting, showMainWindow } from './windowChrome';

import { loadAppIconImage } from './appIcon';

let tray: Tray | null = null;

export function createAppTray(): Tray {
  const trayIcon = loadAppIconImage(16);
  tray = new Tray(trayIcon);
  tray.setToolTip('ARC');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть ARC',
      click: () => {
        showMainWindow({ maximize: true });
      }
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        setAppQuitting();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showMainWindow({ maximize: true });
  });

  tray.on('double-click', () => {
    showMainWindow({ maximize: true });
  });

  return tray;
}

export function destroyAppTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
