import { BrowserWindow } from 'electron';

/** Сообщает renderer об изменении каталога меток/категорий через MCP. */
export function notifyRendererTagCatalogChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send('arc:mcp-tag-catalog-changed', {});
  }
}
