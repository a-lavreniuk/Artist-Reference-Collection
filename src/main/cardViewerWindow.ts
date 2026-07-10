import { BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';

import { readLibraryRootSync } from './libraryRootConfig';
import { getCardByIdFromDb } from './storage/libraryStorage';

export type OpenCardViewerPayload = {
  cardIds: string[];
  startIndex?: number;
};

const viewerWindows = new Set<BrowserWindow>();
let ipcRegistered = false;

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 540;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

function preloadPath(): string {
  return path.resolve(__dirname, '..', 'preload', 'index.js');
}

function viewerPageUrl(cardIds: string[], startIndex: number): string {
  const dev = process.env.NODE_ENV === 'development';
  const query = new URLSearchParams({
    cards: cardIds.join(','),
    index: String(startIndex)
  }).toString();
  if (dev) return `http://localhost:5173/card-viewer.html?${query}`;
  const filePath = path.join(__dirname, '..', 'renderer', 'dist', 'card-viewer.html');
  return `${filePath}?${query}`;
}

function sanitizeCardIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim());
}

function clampOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.2, n));
}

function resolveLibraryAbsPath(relativePath: string): string | null {
  const root = readLibraryRootSync();
  if (!root || !relativePath.trim()) return null;
  return path.join(root, relativePath.replace(/\//g, path.sep));
}

function cardOriginalRel(cardId: string): string | null {
  const root = readLibraryRootSync();
  if (!root) return null;
  const row = getCardByIdFromDb(root, cardId);
  if (!row) return null;
  return row.originalRel || row.thumbMRel || row.thumbSRel || row.thumbLRel || null;
}

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return null;
  return win;
}

export function openCardViewerWindow(payload: OpenCardViewerPayload): void {
  const cardIds = sanitizeCardIds(payload.cardIds);
  if (cardIds.length === 0) return;

  const startIndex = Math.min(
    Math.max(0, typeof payload.startIndex === 'number' && Number.isFinite(payload.startIndex) ? payload.startIndex : 0),
    cardIds.length - 1
  );

  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: '#1a1a1e',
    ...(process.platform === 'win32' ? { roundedCorners: true as const } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  viewerWindows.add(win);
  win.on('closed', () => {
    viewerWindows.delete(win);
  });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });

  const url = viewerPageUrl(cardIds, startIndex);
  if (url.startsWith('http')) {
    void win.loadURL(url);
  } else {
    const [filePath, query = ''] = url.split('?');
    void win.loadFile(filePath, query ? { search: `?${query}` } : undefined);
  }
}

export function registerCardViewerIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:card-viewer-open', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return { ok: false as const };
    const raw = payload as OpenCardViewerPayload;
    openCardViewerWindow({
      cardIds: sanitizeCardIds(raw.cardIds),
      startIndex: raw.startIndex
    });
    return { ok: true as const };
  });

  ipcMain.handle('arc:card-viewer-set-always-on-top', (event, enabled: unknown) => {
    const win = windowFromEvent(event);
    if (!win) return { ok: false as const };
    win.setAlwaysOnTop(Boolean(enabled), 'floating');
    return { ok: true as const };
  });

  ipcMain.handle('arc:card-viewer-set-opacity', (event, value: unknown) => {
    const win = windowFromEvent(event);
    if (!win) return { ok: false as const };
    win.setOpacity(clampOpacity(value));
    return { ok: true as const };
  });

  ipcMain.handle('arc:card-viewer-close', (event) => {
    const win = windowFromEvent(event);
    win?.close();
    return { ok: true as const };
  });

  ipcMain.handle('arc:card-viewer-resolve-path', (_event, relativePath: unknown) => {
    if (typeof relativePath !== 'string' || !relativePath.trim()) return null;
    return resolveLibraryAbsPath(relativePath);
  });

  ipcMain.handle('arc:card-viewer-start-file-drag', async (event, payload: unknown) => {
    const win = windowFromEvent(event);
    if (!win) return { ok: false as const };

    let relativePath: string | null = null;
    let cardId: string | null = null;
    if (typeof payload === 'string') {
      relativePath = payload;
    } else if (payload && typeof payload === 'object') {
      const raw = payload as { relativePath?: unknown; cardId?: unknown };
      if (typeof raw.relativePath === 'string') relativePath = raw.relativePath;
      if (typeof raw.cardId === 'string') cardId = raw.cardId;
    }

    if (!relativePath && cardId) {
      relativePath = cardOriginalRel(cardId);
    }
    if (!relativePath) return { ok: false as const };

    const absPath = resolveLibraryAbsPath(relativePath);
    if (!absPath) return { ok: false as const };

    let icon = nativeImage.createFromPath(absPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    } else {
      icon = icon.resize({ width: 128, height: 128, quality: 'best' });
    }

    win.webContents.startDrag({ file: absPath, icon });
    return { ok: true as const };
  });
}

export function destroyCardViewerWindows(): void {
  for (const win of [...viewerWindows]) {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
  viewerWindows.clear();
}
