import { app, utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';

import type { AiResourceSettings, ModelTier, WorkerRequest, WorkerResponse } from './types';
import { logAiIndexer } from './aiIndexerLog';

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  reject: (err: Error) => void;
  filter?: (msg: WorkerResponse) => boolean;
};

let worker: UtilityProcess | null = null;
let workerReady = false;
let requestSeq = 0;
const pending = new Map<number, PendingRequest>();
let restartAttempts = 0;
const MAX_RESTARTS = 3;

function workerScriptPath(): string {
  return path.join(__dirname, 'aiWorkerProcess.js');
}

function rejectAllPending(message: string): void {
  for (const [, req] of pending) {
    req.reject(new Error(message));
  }
  pending.clear();
}

function spawnWorker(): UtilityProcess {
  const child = utilityProcess.fork(workerScriptPath(), [], {
    serviceName: 'arc-ai-worker',
    stdio: 'pipe'
  });

  child.on('spawn', () => {
    workerReady = true;
    restartAttempts = 0;
  });

  child.on('exit', (code) => {
    workerReady = false;
    worker = null;
    rejectAllPending(`AI worker завершился (код ${code ?? 'unknown'})`);
    if (restartAttempts < MAX_RESTARTS) {
      restartAttempts += 1;
      worker = spawnWorker();
    }
  });

  child.stdout?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    logAiIndexer('ai-worker', { line: text.slice(0, 500) });
  });

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    logAiIndexer('ai-worker stderr', { line: text.slice(0, 500) });
  });

  child.on('message', (msg: WorkerResponse) => {
    for (const [id, req] of [...pending.entries()]) {
      if (req.filter && !req.filter(msg)) continue;
      pending.delete(id);
      req.resolve(msg);
      break;
    }
  });

  return child;
}

export function ensureAiWorker(): UtilityProcess {
  if (!worker || !workerReady) {
    worker = spawnWorker();
  }
  return worker;
}

export function shutdownAiWorker(): void {
  if (worker) {
    try {
      worker.kill();
    } catch {
      /* ignore */
    }
  }
  worker = null;
  workerReady = false;
  rejectAllPending('AI worker остановлен');
}

function sendRequest(msg: WorkerRequest, filter?: (response: WorkerResponse) => boolean): Promise<WorkerResponse> {
  const child = ensureAiWorker();
  const id = ++requestSeq;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('AI worker timeout'));
    }, 120_000);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      filter
    });

    child.postMessage(msg);
  });
}

export async function pingAiWorker(): Promise<boolean> {
  try {
    const res = await sendRequest({ type: 'ping' }, (m) => m.type === 'pong');
    return res.type === 'pong';
  } catch {
    return false;
  }
}

export async function initAiWorker(
  tier: ModelTier,
  modelsDir: string,
  resources: AiResourceSettings
): Promise<{ modelId: string; tier: ModelTier }> {
  const res = await sendRequest(
    { type: 'init', tier, modelsDir, resources },
    (m) => m.type === 'ready' || m.type === 'error'
  );
  if (res.type === 'error') {
    throw new Error(res.message);
  }
  if (res.type !== 'ready') {
    throw new Error('AI worker: unexpected response');
  }
  return { modelId: res.modelId, tier: res.tier };
}

export async function downloadModelInWorker(
  tier: ModelTier,
  modelsDir: string,
  resources: AiResourceSettings,
  onProgress?: (info: number | { percent: number; bytesReceived?: number; bytesTotal?: number }) => void
): Promise<{ modelId: string }> {
  const child = ensureAiWorker();

  return new Promise((resolve, reject) => {
    const onMessage = (msg: WorkerResponse) => {
      if (msg.type === 'download-progress' && msg.tier === tier) {
        onProgress?.({
          percent: msg.percent,
          bytesReceived: msg.bytesReceived,
          bytesTotal: msg.bytesTotal
        });
      }
      if (msg.type === 'download-complete' && msg.tier === tier) {
        child.off('message', onMessage);
        resolve({ modelId: msg.modelId });
      }
      if (msg.type === 'download-error' && msg.tier === tier) {
        child.off('message', onMessage);
        reject(new Error(msg.message));
      }
      if (msg.type === 'error') {
        child.off('message', onMessage);
        reject(new Error(msg.message));
      }
    };

    child.on('message', onMessage);
    child.postMessage({ type: 'download-model', tier, modelsDir, resources } satisfies WorkerRequest);
  });
}

export function cancelModelDownloadInWorker(): void {
  worker?.postMessage({ type: 'cancel-download' } satisfies WorkerRequest);
}

export function pauseModelDownloadInWorker(): void {
  worker?.postMessage({ type: 'pause-download' } satisfies WorkerRequest);
}

export function resumeModelDownloadInWorker(): void {
  worker?.postMessage({ type: 'resume-download' } satisfies WorkerRequest);
}

export async function embedImageInWorker(imagePath: string, modelId: string): Promise<number[]> {
  const res = await sendRequest(
    { type: 'embed-image', imagePath, modelId },
    (m) => (m.type === 'embedding' && m.requestType === 'embed-image') || m.type === 'error'
  );
  if (res.type === 'error') throw new Error(res.message);
  if (res.type !== 'embedding') throw new Error('AI worker: unexpected embedding response');
  return res.vector;
}

export async function embedTextInWorker(text: string, modelId: string): Promise<number[]> {
  const res = await sendRequest(
    { type: 'embed-text', text, modelId },
    (m) => (m.type === 'embedding' && m.requestType === 'embed-text') || m.type === 'error'
  );
  if (res.type === 'error') throw new Error(res.message);
  if (res.type !== 'embedding') throw new Error('AI worker: unexpected embedding response');
  return res.vector;
}

export async function testModelInWorker(
  tier: ModelTier,
  modelsDir: string,
  resources: AiResourceSettings
): Promise<{ ok: boolean; message: string; vectorDim?: number }> {
  const child = ensureAiWorker();
  const timeoutMs = tier === 'heavy' ? 600_000 : 180_000;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('message', onMessage);
      reject(new Error('Тест модели занял слишком много времени'));
    }, timeoutMs);

    const onMessage = (msg: WorkerResponse) => {
      if (msg.type === 'test-result' && msg.tier === tier) {
        clearTimeout(timer);
        child.off('message', onMessage);
        resolve({ ok: msg.ok, message: msg.message, vectorDim: msg.vectorDim });
      }
      if (msg.type === 'error') {
        clearTimeout(timer);
        child.off('message', onMessage);
        reject(new Error(msg.message));
      }
    };

    child.on('message', onMessage);
    child.postMessage({ type: 'test-model', tier, modelsDir, resources } satisfies WorkerRequest);
  });
}

export function getModelsDir(): string {
  return path.join(app.getPath('userData'), 'models');
}
