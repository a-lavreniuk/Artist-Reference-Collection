import { utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';
import {
  getActiveMediaTab,
  getMediaGeneration,
  setActiveMediaTab,
  type MediaSectionTab
} from '../mediaGate';

let child: UtilityProcess | null = null;
let mediaOrigin: string | null = null;
let startPromise: Promise<string> | null = null;
let lastLibraryRoot: string | null = null;
let mediaRestartAttempts = 0;
let mediaIntentionalShutdown = false;
const MAX_MEDIA_RESTARTS = 5;

function workerScriptPath(): string {
  return path.join(__dirname, 'mediaServerWorker.js');
}

function postToWorker(payload: unknown): void {
  if (child) {
    child.postMessage(payload);
  }
}

export function getArcMediaServerOrigin(): string | null {
  return mediaOrigin;
}

export function syncStagingTokenToMediaWorker(
  token: string,
  absPath: string,
  expiresAt: number
): void {
  postToWorker({ type: 'staging-register', token, absPath, expiresAt });
}

export function syncArcMediaServerLibraryRoot(libraryRoot: string | null): void {
  postToWorker({ type: 'library-root', libraryRoot });
}

export function syncArcMediaServerLibraryRoots(roots: Record<string, string>): void {
  postToWorker({ type: 'library-roots', roots });
}

export function syncArcMediaServerActiveTab(tab: MediaSectionTab | null): void {
  postToWorker({
    type: 'active-tab',
    tab,
    generation: getMediaGeneration()
  });
}

export function setActiveMediaTabAndSync(tab: MediaSectionTab | null): void {
  setActiveMediaTab(tab);
  syncArcMediaServerActiveTab(tab);
}

export async function startArcMediaServer(libraryRoot: string | null): Promise<string> {
  lastLibraryRoot = libraryRoot;
  if (mediaOrigin) return mediaOrigin;
  if (startPromise) return startPromise;

  mediaIntentionalShutdown = false;
  startPromise = new Promise<string>((resolve, reject) => {
    const proc = utilityProcess.fork(workerScriptPath(), [], {
      serviceName: 'arc-media-server'
    });
    child = proc;

    const fail = (err: Error) => {
      startPromise = null;
      reject(err);
    };

    proc.on('exit', (code) => {
      const hadReadyOrigin = Boolean(mediaOrigin);
      if (!mediaOrigin) {
        fail(new Error(`arc-media-server exited before ready (${String(code)})`));
      }
      mediaOrigin = null;
      child = null;
      startPromise = null;
      if (mediaIntentionalShutdown || !hadReadyOrigin) return;
      if (mediaRestartAttempts >= MAX_MEDIA_RESTARTS) return;
      mediaRestartAttempts += 1;
      setTimeout(() => {
        void startArcMediaServer(lastLibraryRoot);
      }, 750);
    });

    proc.on('message', (message: { type?: string; origin?: string }) => {
      if (message?.type === 'ready' && typeof message.origin === 'string') {
        mediaOrigin = message.origin;
        mediaRestartAttempts = 0;
        resolve(message.origin);
      }
    });

    proc.on('spawn', () => {
      postToWorker({ type: 'init', libraryRoot });
      syncArcMediaServerActiveTab(getActiveMediaTab());
    });

    global.setTimeout(() => {
      if (!mediaOrigin) {
        fail(new Error('arc-media-server start timeout'));
        proc.kill();
      }
    }, 15000);
  });

  return startPromise;
}

export function shutdownArcMediaServer(): void {
  mediaIntentionalShutdown = true;
  if (child) {
    child.kill();
  }
  child = null;
  mediaOrigin = null;
  startPromise = null;
}
