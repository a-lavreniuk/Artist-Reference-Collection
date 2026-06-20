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

export function syncArcMediaServerLibraryRoot(libraryRoot: string | null): void {
  postToWorker({ type: 'library-root', libraryRoot });
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
  if (mediaOrigin) return mediaOrigin;
  if (startPromise) return startPromise;

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
      if (!mediaOrigin) {
        fail(new Error(`arc-media-server exited before ready (${String(code)})`));
      }
      mediaOrigin = null;
      child = null;
      startPromise = null;
    });

    proc.on('message', (message: { type?: string; origin?: string }) => {
      if (message?.type === 'ready' && typeof message.origin === 'string') {
        mediaOrigin = message.origin;
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
  if (child) {
    child.kill();
  }
  child = null;
  mediaOrigin = null;
  startPromise = null;
}
