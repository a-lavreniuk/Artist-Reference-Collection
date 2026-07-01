import { BrowserWindow } from 'electron';

/** Сообщает renderer о новых карточках после Import API (расширение браузера). */
export function notifyRendererExtensionImport(cardIds: string[]): void {
  if (cardIds.length === 0) return;
  const payload = { cardIds };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send('arc:extension-import-saved', payload);
  }
}
