import type { WebContents } from 'electron';

function isFileUrl(url: string): boolean {
  return url.startsWith('file:');
}

/** Блокирует навигацию/новые окна при drop файлов из ОС (иначе Electron открывает их как file://). */
export function bindFileDropGuards(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (isFileUrl(url)) event.preventDefault();
  });

  contents.setWindowOpenHandler((details) => {
    if (isFileUrl(details.url)) return { action: 'deny' };
    return { action: 'deny' };
  });
}
