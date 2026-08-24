import { Menu, Tray } from 'electron';

import { applyOsAppMenus, buildAppMenuTemplate } from './appMenuCommands';
import { showMainWindowFromUserAction } from './windowChrome';
import { loadAppIconImage } from './appIcon';

let tray: Tray | null = null;

export function refreshAppTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildAppMenuTemplate()));
}

export function refreshAppMenuSurfaces(): void {
  refreshAppTrayMenu();
  applyOsAppMenus();
}

export function createAppTray(): Tray {
  const trayIcon = loadAppIconImage(16);
  tray = new Tray(trayIcon);
  tray.setToolTip('ARC');
  refreshAppTrayMenu();
  applyOsAppMenus();

  tray.on('click', () => {
    showMainWindowFromUserAction();
  });

  tray.on('double-click', () => {
    showMainWindowFromUserAction();
  });

  return tray;
}

export function destroyAppTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
