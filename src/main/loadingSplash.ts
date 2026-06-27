import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

import {
  applyMainWindowOnboardingMode
} from './onboardingWindowMode';

export const LOADING_SPLASH_SIZE = 512;
const MIN_SPLASH_MS = 1000;
const FADE_OUT_MS = 250;
const PROGRESS_TICK_MS = 40;

const LOADING_PHASES = {
  startup: 'Запуск приложения…',
  modules: 'Инициализация модулей…',
  ui: 'Загрузка интерфейса…',
  data: 'Подготовка данных…',
  gallery: 'Подготовка галереи…',
  interface: 'Подготовка интерфейса…'
} as const;

let splashWin: BrowserWindow | null = null;
let splashReady = false;
let splashReadyResolve: (() => void) | null = null;
let ipcRegistered = false;

let displayedPercent = 0;
let targetPercent = 0;
let phaseText: string = LOADING_PHASES.startup;
let progressTimer: ReturnType<typeof setInterval> | null = null;

let bootstrapCompleteResolve: (() => void) | null = null;
let bootstrapCompletePromise: Promise<void> | null = null;

let pendingMainWin: BrowserWindow | null = null;
let pendingOnboardingMode = false;
let mainReadyToShow = false;
let bootstrapDone = false;
let startupFinishing = false;
let splashShownAt = 0;

function preloadPath(): string {
  return path.resolve(__dirname, '..', 'preload', 'index.js');
}

function splashPageUrl(): string {
  const dev = process.env.NODE_ENV === 'development';
  if (dev) return 'http://localhost:5173/loading-screen.html';
  return path.join(__dirname, '..', 'renderer', 'dist', 'loading-screen.html');
}

function resetBootstrapWaiter(): void {
  bootstrapCompletePromise = new Promise<void>((resolve) => {
    bootstrapCompleteResolve = resolve;
  });
}

function stopProgressTicker(): void {
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function pushSplashState(forcePercent?: number): void {
  if (!splashWin || splashWin.isDestroyed() || !splashReady) return;
  const percent = forcePercent ?? displayedPercent;
  splashWin.webContents.send('loading:progress-update', {
    percent,
    phaseText,
    version: app.getVersion()
  });
}

function startProgressTicker(): void {
  if (progressTimer !== null) return;
  progressTimer = setInterval(() => {
    if (displayedPercent >= targetPercent) {
      stopProgressTicker();
      return;
    }
    displayedPercent = Math.min(targetPercent, displayedPercent + 1);
    pushSplashState();
  }, PROGRESS_TICK_MS);
}

export function setLoadingSplashMilestone(percent: number, text?: string): void {
  targetPercent = Math.min(99, Math.max(targetPercent, percent));
  if (text) phaseText = text;
  startProgressTicker();
}

function waitForSplashReady(timeoutMs = 15000): Promise<void> {
  if (splashReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      splashReadyResolve = null;
      reject(new Error('Loading splash ready timeout'));
    }, timeoutMs);
    splashReadyResolve = () => {
      clearTimeout(timer);
      splashReadyResolve = null;
      resolve();
    };
  });
}

async function createLoadingSplashWindow(): Promise<BrowserWindow> {
  if (splashWin && !splashWin.isDestroyed()) {
    return splashWin;
  }

  splashReady = false;
  displayedPercent = 0;
  targetPercent = 0;
  phaseText = LOADING_PHASES.startup;

  const win = new BrowserWindow({
    width: LOADING_SPLASH_SIZE,
    height: LOADING_SPLASH_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { roundedCorners: false as const } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  splashWin = win;

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    win.show();
    splashShownAt = Date.now();
    pushSplashState(0);
  });

  const pageUrl = splashPageUrl();
  if (pageUrl.startsWith('http')) {
    await win.loadURL(pageUrl);
  } else {
    await win.loadFile(pageUrl);
  }

  return win;
}

async function closeLoadingSplashWithFade(): Promise<void> {
  if (!splashWin || splashWin.isDestroyed()) return;

  displayedPercent = 100;
  targetPercent = 100;
  pushSplashState(100);

  return new Promise((resolve) => {
    const win = splashWin;
    if (!win || win.isDestroyed()) {
      resolve();
      return;
    }

    const onFadeComplete = () => {
      ipcMain.removeListener('loading:splash-fade-complete', onFadeComplete);
      if (win && !win.isDestroyed()) win.destroy();
      if (splashWin === win) splashWin = null;
      splashReady = false;
      resolve();
    };

    ipcMain.once('loading:splash-fade-complete', onFadeComplete);
    win.webContents.send('loading:splash-fade-out');
    setTimeout(onFadeComplete, FADE_OUT_MS + 150);
  });
}

export function markMainWindowReadyToShow(win: BrowserWindow, onboardingMode: boolean): void {
  pendingMainWin = win;
  pendingOnboardingMode = onboardingMode;
  mainReadyToShow = true;
  void tryFinishStartup();
}

async function tryFinishStartup(): Promise<void> {
  if (startupFinishing || !mainReadyToShow || !bootstrapDone || !pendingMainWin) return;
  if (pendingMainWin.isDestroyed()) return;

  startupFinishing = true;

  const elapsed = Date.now() - splashShownAt;
  if (splashShownAt > 0 && elapsed < MIN_SPLASH_MS) {
    await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));
  }

  while (displayedPercent < 100) {
    displayedPercent = Math.min(100, displayedPercent + 1);
    pushSplashState();
    await new Promise((r) => setTimeout(r, PROGRESS_TICK_MS));
  }

  await closeLoadingSplashWithFade();

  const win = pendingMainWin;
  const onboardingMode = pendingOnboardingMode;
  pendingMainWin = null;
  mainReadyToShow = false;
  bootstrapDone = false;
  startupFinishing = false;

  if (win.isDestroyed()) return;

  if (onboardingMode) {
    applyMainWindowOnboardingMode(win);
  } else if (!win.isMaximized()) {
    win.maximize();
  }
  win.show();
}

export function waitForLoadingBootstrapComplete(): Promise<void> {
  if (!bootstrapCompletePromise) resetBootstrapWaiter();
  return bootstrapCompletePromise!;
}

export async function runLoadingSplashAtStartup(): Promise<void> {
  resetBootstrapWaiter();
  splashShownAt = 0;
  mainReadyToShow = false;
  bootstrapDone = false;
  startupFinishing = false;

  await createLoadingSplashWindow();
  setLoadingSplashMilestone(0, LOADING_PHASES.startup);
  await waitForSplashReady().catch(() => {
    splashReady = true;
  });
}

export function registerLoadingSplashIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('loading:splash-ready', () => {
    splashReady = true;
    pushSplashState();
    splashReadyResolve?.();
    splashReadyResolve = null;
    return { ok: true };
  });

  ipcMain.handle('loading:bootstrap-progress', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return { ok: false };
    const p = payload as { percent?: unknown; phaseText?: unknown };
    const percent = typeof p.percent === 'number' ? p.percent : NaN;
    const text = typeof p.phaseText === 'string' ? p.phaseText : undefined;
    if (!Number.isFinite(percent)) return { ok: false };
    setLoadingSplashMilestone(Math.min(99, Math.max(55, percent)), text);
    return { ok: true };
  });

  ipcMain.handle('loading:bootstrap-complete', () => {
    setLoadingSplashMilestone(99, phaseText);
    bootstrapCompleteResolve?.();
    bootstrapCompleteResolve = null;
    bootstrapDone = true;
    void tryFinishStartup();
    return { ok: true };
  });
}

export function destroyLoadingSplash(): void {
  stopProgressTicker();
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.destroy();
  }
  splashWin = null;
  splashReady = false;
}
