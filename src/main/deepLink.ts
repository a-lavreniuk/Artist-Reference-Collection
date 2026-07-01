import { app, BrowserWindow } from 'electron';
import path from 'path';

export const ARC_PROTOCOL = 'arc';
export const ARC_LAUNCH_HOST = 'launch';

/** URL для запуска / фокуса ARC из браузера (после регистрации custom protocol). */
export function arcLaunchUrl(): string {
  return `${ARC_PROTOCOL}://${ARC_LAUNCH_HOST}`;
}

let pendingDeepLink: string | undefined;

function isArcLaunchUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== `${ARC_PROTOCOL}:`) return false;
    const host = u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0];
    return host === ARC_LAUNCH_HOST || u.pathname === `/${ARC_LAUNCH_HOST}`;
  } catch {
    return false;
  }
}

export function extractDeepLinkFromArgv(argv: readonly string[]): string | undefined {
  return argv.find((a) => a.startsWith(`${ARC_PROTOCOL}://`));
}

export function focusMainApplicationWindow(): void {
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  const main = wins.find((w) => !w.webContents.getURL().includes('loading')) ?? wins[0];
  if (!main) return;
  if (main.isMinimized()) main.restore();
  if (!main.isVisible()) main.show();
  main.focus();
}

export function handleDeepLink(url: string | undefined): void {
  if (!url || !isArcLaunchUrl(url)) return;
  focusMainApplicationWindow();
}

export function registerArcProtocolClient(): void {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(ARC_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
    return;
  }

  app.setAsDefaultProtocolClient(ARC_PROTOCOL);
}

/** Один экземпляр приложения; второй экземпляр передаёт deep link первому. */
export function bindDeepLinkSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', (_event, commandLine) => {
    handleDeepLink(extractDeepLinkFromArgv(commandLine));
    focusMainApplicationWindow();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (app.isReady()) {
      handleDeepLink(url);
    } else {
      pendingDeepLink = url;
    }
  });

  return true;
}

export function consumePendingDeepLink(): void {
  const argvLink = extractDeepLinkFromArgv(process.argv);
  if (argvLink) {
    handleDeepLink(argvLink);
    return;
  }
  if (pendingDeepLink) {
    handleDeepLink(pendingDeepLink);
    pendingDeepLink = undefined;
  }
}
