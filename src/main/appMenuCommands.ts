import { app, ipcMain, Menu } from 'electron';
import type { JumpListCategory, MenuItemConstructorOptions } from 'electron';
import path from 'path';

import { readAppPreferencesSync } from './appPreferences';
import {
  APP_MENU_NAV_PATH,
  appMenuCommandFlag,
  parseAppMenuCommandFromArgv,
  type AppMenuCommand,
  type AppMenuRendererAction
} from './appMenuCommandParse';
import { pickMediaFilesForImport } from './ipc';
import { startAreaScreenshot } from './screenshotShortcut';
import {
  getMainWindow,
  hideMainWindow,
  isMainWindowVisible,
  setAppQuitting,
  showMainWindowFromUserAction
} from './windowChrome';

const APP_MENU_ACTION_CHANNEL = 'arc:app-menu-action';

let pendingRendererAction: AppMenuRendererAction | null = null;
let nextDeliveryId = 0;
let ipcRegistered = false;

function jumpListTaskLaunch(command: AppMenuCommand): { program: string; args: string } {
  const flag = appMenuCommandFlag(command);
  if (app.isPackaged) {
    return { program: process.execPath, args: flag };
  }
  const script = path.resolve(process.argv[1] ?? '.');
  return { program: process.execPath, args: `"${script}" ${flag}` };
}

function jumpListTask(title: string, command: AppMenuCommand): Electron.JumpListItem {
  const launch = jumpListTaskLaunch(command);
  return {
    type: 'task',
    title,
    description: title,
    program: launch.program,
    args: launch.args,
    iconPath: launch.program,
    iconIndex: 0
  };
}

function sendRendererAction(
  action: { type: 'navigate'; path: string } | { type: 'import-files'; paths: string[] }
): void {
  nextDeliveryId += 1;
  const withId: AppMenuRendererAction =
    action.type === 'navigate'
      ? { type: 'navigate', path: action.path, deliveryId: nextDeliveryId }
      : { type: 'import-files', paths: action.paths, deliveryId: nextDeliveryId };
  pendingRendererAction = withId;
  const win = getMainWindow();
  if (!win || win.isDestroyed() || win.webContents.isLoadingMainFrame()) {
    return;
  }
  win.webContents.send(APP_MENU_ACTION_CHANNEL, withId);
}

async function runAddFromMenu(): Promise<void> {
  const visible = isMainWindowVisible();
  const paths = await pickMediaFilesForImport({ attachToWindow: visible });
  if (paths.length === 0) return;
  sendRendererAction({ type: 'import-files', paths });
}

function runNavigate(pathName: string): void {
  if (!isMainWindowVisible()) {
    showMainWindowFromUserAction();
  }
  sendRendererAction({ type: 'navigate', path: pathName });
}

export async function runAppMenuCommand(command: AppMenuCommand): Promise<void> {
  switch (command) {
    case 'open':
      showMainWindowFromUserAction();
      return;
    case 'hide':
      hideMainWindow();
      return;
    case 'add':
      await runAddFromMenu();
      return;
    case 'screenshot':
      startAreaScreenshot();
      return;
    case 'gallery':
      runNavigate(APP_MENU_NAV_PATH.gallery);
      return;
    case 'collections':
      runNavigate(APP_MENU_NAV_PATH.collections);
      return;
    case 'moodboard':
      runNavigate(APP_MENU_NAV_PATH.moodboard);
      return;
    case 'settings':
      runNavigate(APP_MENU_NAV_PATH.settings);
      return;
    case 'quit':
      setAppQuitting();
      app.quit();
  }
}

export function buildAppMenuTemplate(): MenuItemConstructorOptions[] {
  const screenshotsEnabled = readAppPreferencesSync().screenshotsEnabled;
  const run = (command: AppMenuCommand) => () => {
    void runAppMenuCommand(command);
  };
  return [
    { label: 'Открыть', click: run('open') },
    { label: 'Скрыть', click: run('hide') },
    { type: 'separator' },
    { label: 'Добавить', click: run('add') },
    { label: 'Скриншот', enabled: screenshotsEnabled, click: run('screenshot') },
    { type: 'separator' },
    { label: 'Библиотека', click: run('gallery') },
    { label: 'Коллекции', click: run('collections') },
    { label: 'Мудборд', click: run('moodboard') },
    { type: 'separator' },
    { label: 'Настройки', click: run('settings') },
    { label: 'Выход', click: run('quit') }
  ];
}

export function applyWindowsJumpList(): void {
  if (process.platform !== 'win32') return;
  const screenshotsEnabled = readAppPreferencesSync().screenshotsEnabled;
  const items: Electron.JumpListItem[] = [
    jumpListTask('Открыть', 'open'),
    jumpListTask('Скрыть', 'hide'),
    { type: 'separator' },
    jumpListTask('Добавить', 'add')
  ];
  if (screenshotsEnabled) {
    items.push(jumpListTask('Скриншот', 'screenshot'));
  }
  items.push(
    { type: 'separator' },
    jumpListTask('Библиотека', 'gallery'),
    jumpListTask('Коллекции', 'collections'),
    jumpListTask('Мудборд', 'moodboard'),
    { type: 'separator' },
    jumpListTask('Настройки', 'settings'),
    jumpListTask('Выход', 'quit')
  );
  const categories: JumpListCategory[] = [
    {
      type: 'custom',
      name: 'ARC',
      items
    }
  ];
  try {
    app.setJumpList(categories);
  } catch {
    /* Jump List недоступен вне упакованного Windows-приложения */
  }
}

export function applyMacDockMenu(): void {
  if (process.platform !== 'darwin' || !app.dock) return;
  app.dock.setMenu(Menu.buildFromTemplate(buildAppMenuTemplate()));
}

export function applyOsAppMenus(): void {
  applyWindowsJumpList();
  applyMacDockMenu();
}

export function consumeStartupAppMenuCommand(argv: readonly string[] = process.argv): void {
  const command = parseAppMenuCommandFromArgv(argv);
  if (!command) return;
  void runAppMenuCommand(command);
}

export function registerAppMenuIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:show-main-window-from-menu', () => {
    showMainWindowFromUserAction();
    return { ok: true };
  });

  ipcMain.handle('arc:app-menu-take-pending', () => {
    const action = pendingRendererAction;
    pendingRendererAction = null;
    return action;
  });
}
