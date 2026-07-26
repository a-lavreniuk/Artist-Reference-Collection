import { readFile } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createServer } from 'net';

import type { AiResourceSettings } from './types';
import { importEsm } from './esmImport';
import {
  ensureLlamaRuntime,
  hasCudaCudartLibs,
  llamaServerBinaryPath,
  resolveLlamaServerBinaryFromUserData
} from './llamaRuntime';
import { ensureVisionSafeImagePath } from './indexVisionImage';
import { logAiIndexer } from './aiIndexerLog';
import {
  LLAMA_CTX_SIZE_CHAT,
  LLAMA_CTX_SIZE_EMBED,
  LLAMA_IMAGE_MIN_TOKENS,
  LLAMA_PARALLEL_SLOTS
} from './llamaServerLimits';
import { existsSync } from 'fs';
import path from 'path';

export type LlamaServerHooks = {
  onStatus?: (message: string) => void;
};

type LlamaEmbeddingContextLike = {
  getEmbeddingFor: (input: string) => Promise<{ vector: readonly number[] }>;
  dispose: () => Promise<void>;
};

type LlamaModelLike = {
  createEmbeddingContext: (opts?: { threads?: number }) => Promise<LlamaEmbeddingContextLike>;
  dispose: () => Promise<void>;
};

type LlamaLike = {
  loadModel: (opts: { modelPath: string; gpuLayers?: number }) => Promise<LlamaModelLike>;
};

type ServerSession = {
  process: ChildProcessWithoutNullStreams;
  port: number;
  baseUrl: string;
};

let sharedLlama: LlamaLike | null = null;
let qwenEmbedContext: LlamaEmbeddingContextLike | null = null;
let qwenEmbedModelPath: string | null = null;
let serverSession: ServerSession | null = null;
let serverConfigKey: string | null = null;

const JOYCAPTION_INDEX_PROMPT =
  'Напиши описательную подпись к этому изображению на русском языке. Опиши предмет, цвета, композицию, стиль и настроение одним связным абзацем.';

const JOYCAPTION_MAX_TOKENS = 1024;

/** Сериализация caption-запросов: suggest и indexer не бьют llama-server параллельно. */
let captionQueue: Promise<unknown> = Promise.resolve();

function enqueueCaption<T>(task: () => Promise<T>): Promise<T> {
  const run = captionQueue.then(task, task);
  captionQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => {
        if (addr && typeof addr === 'object') resolve(addr.port);
        else reject(new Error('Не удалось выделить порт для llama-server'));
      });
    });
    srv.on('error', reject);
  });
}

export function resolveLlamaServerBinary(userDataPath: string, preferCuda: boolean): string | null {
  return resolveLlamaServerBinaryFromUserData(userDataPath, preferCuda);
}

async function ensureSharedLlama(): Promise<LlamaLike> {
  if (sharedLlama) return sharedLlama;
  const { getLlama } = await importEsm<typeof import('node-llama-cpp')>('node-llama-cpp');
  sharedLlama = await getLlama('lastBuild');
  return sharedLlama;
}

export async function ensureQwenTextEmbedder(
  modelPath: string,
  resources: AiResourceSettings
): Promise<LlamaEmbeddingContextLike> {
  if (qwenEmbedContext && qwenEmbedModelPath === modelPath) return qwenEmbedContext;

  await disposeQwenTextEmbedder();
  const llama = await ensureSharedLlama();
  const model = await llama.loadModel({
    modelPath,
    gpuLayers: resources.gpuLayers ?? 0
  });
  qwenEmbedContext = await model.createEmbeddingContext({
    threads: resources.threads ?? 4
  });
  qwenEmbedModelPath = modelPath;
  return qwenEmbedContext;
}

export async function disposeQwenTextEmbedder(): Promise<void> {
  if (qwenEmbedContext) {
    await qwenEmbedContext.dispose();
    qwenEmbedContext = null;
    qwenEmbedModelPath = null;
  }
}

export async function embedTextWithNodeLlama(
  modelPath: string,
  text: string,
  resources: AiResourceSettings
): Promise<number[]> {
  const ctx = await ensureQwenTextEmbedder(modelPath, resources);
  const embedding = await ctx.getEmbeddingFor(text.trim());
  return Array.from(embedding.vector);
}

function isCudaRuntimeDir(runtimeDir: string, userDataPath: string): boolean {
  // Path may end with `...\cuda` (no trailing slash) — do not require a following separator.
  if (path.basename(runtimeDir).toLowerCase() !== 'cuda') return false;
  return hasCudaCudartLibs(userDataPath);
}

function pickFatalServerLog(recentLogs: string[]): string {
  const fatal = [...recentLogs]
    .reverse()
    .find(
      (line) =>
        /GGML_ASSERT|failed to allocate|failed to load|exiting due to|error loading model/i.test(line) &&
        !/require at minimum \d+ image tokens/i.test(line)
    );
  if (fatal) return fatal;
  return recentLogs.slice(-2).join(' | ');
}

async function waitForServerReady(
  baseUrl: string,
  child: ChildProcessWithoutNullStreams,
  timeoutMs = 600_000,
  hooks?: LlamaServerHooks,
  recentLogs?: string[]
): Promise<void> {
  const started = Date.now();
  let lastStatusAt = 0;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null || child.signalCode != null) {
      const hint = pickFatalServerLog(recentLogs ?? []);
      throw new Error(
        hint.includes('failed to allocate') || hint.includes('kv cache')
          ? 'Не хватило памяти для модели (уменьшите контекст или закройте другие приложения).'
          : hint.includes('GGML_ASSERT')
            ? 'llama-server аварийно завершился при загрузке модели (обновите CUDA-среду vision в настройках AI).'
            : `llama-server завершился при загрузке${hint ? `: ${hint.slice(0, 240)}` : ' (проверьте RAM и CUDA)'}`
      );
    }
    const elapsedSec = Math.floor((Date.now() - started) / 1000);
    if (hooks?.onStatus && Date.now() - lastStatusAt >= 2000) {
      lastStatusAt = Date.now();
      hooks.onStatus(`Ожидание llama-server… ${elapsedSec} с`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) {
        logAiIndexer('llama-server готов', { elapsedSec });
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('llama-server не ответил вовремя (проверьте RAM и настройки GPU)');
}

export async function ensureLlamaServer(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string | null,
  resources: AiResourceSettings,
  mode: 'embed' | 'chat',
  hooks?: LlamaServerHooks
): Promise<ServerSession> {
  const key = `${weightsPath}::${mmprojPath ?? ''}::${mode}::${resources.gpuLayers}`;
  if (serverSession && serverConfigKey === key) return serverSession;

  await shutdownLlamaServer();

  const preferCuda = (resources.gpuLayers ?? 0) > 0;
  if (preferCuda && existsSync(llamaServerBinaryPath(userDataPath, 'cuda'))) {
    try {
      hooks?.onStatus?.('Проверка CUDA-среды…');
      await ensureLlamaRuntime(userDataPath, 'cuda', (percent) => {
        if (percent < 100) hooks?.onStatus?.(`Докачка CUDA-библиотек… ${percent}%`);
      });
    } catch (err) {
      logAiIndexer('CUDA ensure failed', {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const binary = resolveLlamaServerBinary(userDataPath, preferCuda);
  if (!binary) {
    throw new Error(
      'llama-server не найден. Переустановите тяжёлую модель в настройках AI Поиска.'
    );
  }

  const runtimeDir = path.dirname(binary);
  const usingCuda = isCudaRuntimeDir(runtimeDir, userDataPath);
  const ctxSize = mode === 'embed' ? LLAMA_CTX_SIZE_EMBED : LLAMA_CTX_SIZE_CHAT;
  const gpuLayers = usingCuda ? Math.max(0, resources.gpuLayers ?? 0) : 0;
  const port = await getFreePort();
  logAiIndexer('Запуск llama-server', {
    mode,
    port,
    gpuLayers,
    ctxSize,
    parallel: LLAMA_PARALLEL_SLOTS,
    usingCuda,
    runtimeDir
  });
  hooks?.onStatus?.('Запуск llama-server…');
  const args = [
    '-m',
    weightsPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-ngl',
    String(gpuLayers),
    '-t',
    String(resources.threads ?? 4),
    '-c',
    String(ctxSize),
    '-np',
    String(LLAMA_PARALLEL_SLOTS),
    '--no-warmup'
  ];

  if (mmprojPath) {
    args.push('--mmproj', mmprojPath, '--image-min-tokens', String(LLAMA_IMAGE_MIN_TOKENS));
  }

  if (mode === 'embed') {
    args.push('--embedding', '--pooling', 'last');
  }

  const pathEnv = process.env.PATH ?? process.env.Path ?? '';
  const child = spawn(binary, args, {
    stdio: 'pipe',
    windowsHide: true,
    cwd: runtimeDir,
    env: {
      ...process.env,
      PATH: `${runtimeDir}${path.delimiter}${pathEnv}`
    }
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const recentLogs: string[] = [];

  child.stderr.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (!line) return;
    recentLogs.push(line.slice(0, 500));
    if (recentLogs.length > 20) recentLogs.shift();
    logAiIndexer('llama-server', { line: line.slice(0, 500) });
  });

  child.on('exit', () => {
    if (serverSession?.process === child) {
      serverSession = null;
      serverConfigKey = null;
    }
  });

  serverSession = { process: child, port, baseUrl };
  serverConfigKey = key;
  try {
    await waitForServerReady(baseUrl, child, 600_000, hooks, recentLogs);
  } catch (err) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    if (serverSession?.process === child) {
      serverSession = null;
      serverConfigKey = null;
    }
    throw err;
  }
  return serverSession;
}

export async function shutdownLlamaServer(): Promise<void> {
  if (!serverSession) return;
  try {
    serverSession.process.kill();
  } catch {
    /* ignore */
  }
  serverSession = null;
  serverConfigKey = null;
}

async function imageToDataUrl(imagePath: string): Promise<string> {
  const ext = path.extname(imagePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  const data = await readFile(imagePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

export async function embedImageViaServer(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string,
  imagePath: string,
  resources: AiResourceSettings
): Promise<number[]> {
  const session = await ensureLlamaServer(userDataPath, weightsPath, mmprojPath, resources, 'embed');
  const vision = await ensureVisionSafeImagePath(imagePath);
  try {
    const dataUrl = await imageToDataUrl(vision.path);

    const res = await fetch(`${session.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: [{ type: 'image_url', image_url: { url: dataUrl } }]
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`embeddings(image) failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = json.data?.[0]?.embedding;
    if (!vector?.length) throw new Error('Пустой embedding для изображения');
    return vector;
  } finally {
    await vision.dispose();
  }
}

export async function embedTextViaServer(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string | null,
  text: string,
  resources: AiResourceSettings
): Promise<number[]> {
  const session = await ensureLlamaServer(userDataPath, weightsPath, mmprojPath, resources, 'embed');
  const res = await fetch(`${session.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text.trim() })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embeddings(text) failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = json.data?.[0]?.embedding;
  if (!vector?.length) throw new Error('Пустой embedding для текста');
  return vector;
}

export async function captionImageViaServer(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string,
  imagePath: string,
  resources: AiResourceSettings,
  prompt = JOYCAPTION_INDEX_PROMPT,
  hooks?: LlamaServerHooks
): Promise<string> {
  return enqueueCaption(async () => {
    const session = await ensureLlamaServer(userDataPath, weightsPath, mmprojPath, resources, 'chat', hooks);
    const vision = await ensureVisionSafeImagePath(imagePath);
    try {
      const dataUrl = await imageToDataUrl(vision.path);
      logAiIndexer('JoyCaption: запрос подписи', {
        image: path.basename(imagePath),
        vision: path.basename(vision.path)
      });
      hooks?.onStatus?.('Генерация подписи к изображению…');

      const res = await fetch(`${session.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'joycaption',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: JOYCAPTION_MAX_TOKENS
        })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`caption failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content.trim();
      if (Array.isArray(content)) {
        const text = content.map((part) => part.text ?? '').join(' ').trim();
        if (text) return text;
      }
      throw new Error('JoyCaption вернул пустой ответ');
    } finally {
      await vision.dispose();
    }
  });
}

export async function shutdownLlamaBridge(): Promise<void> {
  await shutdownLlamaServer();
  await disposeQwenTextEmbedder();
}

export { JOYCAPTION_INDEX_PROMPT };
