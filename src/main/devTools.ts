import { BrowserWindow, globalShortcut } from 'electron';

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
  const shortcuts = ['F12', 'CommandOrControl+Shift+I'] as const;

  for (const accelerator of shortcuts) {
    if (!globalShortcut.register(accelerator, toggleDevTools)) {
      console.warn(`[devtools] shortcut not registered: ${accelerator}`);
    }
  }
}

export function unregisterDevToolsShortcuts(): void {
  globalShortcut.unregister('F12');
  globalShortcut.unregister('CommandOrControl+Shift+I');
}
