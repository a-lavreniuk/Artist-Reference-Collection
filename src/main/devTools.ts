import { BrowserWindow, globalShortcut } from 'electron';

import { DEVTOOLS_ACCELERATORS } from './shared/shortcutAccelerators';

function focusedWebContents(): Electron.WebContents | null {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return win && !win.isDestroyed() ? win.webContents : null;
}

export function toggleDevTools(): void {
  const contents = focusedWebContents();
  if (!contents || contents.isDestroyed()) return;

  if (contents.isDevToolsOpened()) {
    contents.closeDevTools();
  } else {
    contents.openDevTools({ mode: 'detach' });
  }
}

/** F12 и Ctrl+Shift+I — в т.ч. без меню приложения (Windows). */
export function registerDevToolsShortcuts(): void {
  for (const accelerator of DEVTOOLS_ACCELERATORS) {
    if (!globalShortcut.register(accelerator, toggleDevTools)) {
      console.warn(`[devtools] shortcut not registered: ${accelerator}`);
    }
  }
}

export function unregisterDevToolsShortcuts(): void {
  for (const accelerator of DEVTOOLS_ACCELERATORS) {
    globalShortcut.unregister(accelerator);
  }
}
