import { BrowserWindow } from 'electron';

export type ExtensionImportNotifyPayload = {
  cardIds: string[];
  collectionId?: string;
  quiet?: boolean;
};

/** Сообщает renderer о новых карточках после Import API (расширение браузера). */
export function notifyRendererExtensionImport(
  cardIds: string[],
  opts?: { collectionId?: string; quiet?: boolean }
): void {
  if (cardIds.length === 0) return;
  const payload: ExtensionImportNotifyPayload = {
    cardIds,
    ...(opts?.collectionId ? { collectionId: opts.collectionId } : {}),
    ...(opts?.quiet ? { quiet: true } : {})
  };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send('arc:extension-import-saved', payload);
  }
}
