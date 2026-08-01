import { readFile } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createServer } from 'net';
import { Agent, fetch as undiciFetch } from 'undici';

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
  LLAMA_FIT_TARGET_MIB,
  LLAMA_IMAGE_MAX_TOKENS,
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
  /** MTMD placeholder used in multimodal embedding prompts (from env /props). */
  mediaMarker: string;
};

/** Stable marker so clients and server agree without fetching /props first. */
export const LLAMA_MEDIA_MARKER_DEFAULT = '<__media__>';

let sharedLlama: LlamaLike | null = null;
let qwenEmbedContext: LlamaEmbeddingContextLike | null = null;
let qwenEmbedModelPath: string | null = null;
let serverSession: ServerSession | null = null;
let serverConfigKey: string | null = null;
/** Child currently waiting for /health — must be killable before serverSession is assigned. */
let startingChild: ChildProcessWithoutNullStreams | null = null;
/** In-flight ensure: callers with the same logical key await one startup instead of racing. */
let ensureInflight: { logicalKey: string; promise: Promise<ServerSession> } | null = null;
/**
 * After CUDA crashes (e.g. old runtime GGML_ASSERT), keep indexing on CPU for this model key
 * instead of restarting CUDA on every card.
 */
const cudaLoadFailedLogicalKeys = new Set<string>();

const JOYCAPTION_INDEX_PROMPT =
  'Напиши описательную подпись к этому изображению на русском языке. Опиши предмет, цвета, композицию, стиль и настроение одним связным абзацем.';

const JOYCAPTION_MAX_TOKENS = 1024;
const MODEL_LOADING_RETRY_ATTEMPTS = 40;
const MODEL_LOADING_RETRY_MS = 500;
/** Heavy VL image embeds can take many minutes; undici defaults (~300s) abort mid-request. */
const LLAMA_FETCH_TIMEOUT_MS = 45 * 60 * 1000;
const LLAMA_NETWORK_RETRY_ATTEMPTS = 3;

const llamaFetchAgent = new Agent({
  connectTimeout: 60_000,
  headersTimeout: LLAMA_FETCH_TIMEOUT_MS,
  bodyTimeout: LLAMA_FETCH_TIMEOUT_MS,
  keepAliveTimeout: 60_000
});

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

export function buildLlamaServerLogicalKey(
  weightsPath: string,
  mmprojPath: string | null,
  mode: 'embed' | 'chat'
): string {
  return `${weightsPath}::${mmprojPath ?? ''}::${mode}`;
}

export function buildLlamaServerConfigKey(
  weightsPath: string,
  mmprojPath: string | null,
  mode: 'embed' | 'chat',
  gpuLayers: number
): string {
  return `${buildLlamaServerLogicalKey(weightsPath, mmprojPath, mode)}::${gpuLayers}`;
}

export function isLlamaModelLoadingResponse(status: number, body: string): boolean {
  if (status !== 503) return false;
  return /Loading model|unavailable_error/i.test(body);
}

export function formatLlamaServerExitError(hint: string, usingCuda: boolean): string {
  if (/failed to allocate|kv cache/i.test(hint)) {
    return 'Не хватило памяти для модели (уменьшите контекст или закройте другие приложения).';
  }
  if (/GGML_ASSERT/i.test(hint)) {
    return usingCuda
      ? 'llama-server аварийно завершился при загрузке модели на GPU (обновите CUDA-среду vision в настройках AI или снизьте нагрузку на VRAM).'
      : 'llama-server аварийно завершился при загрузке модели (проверьте файлы модели и объём RAM).';
  }
  return `llama-server завершился при загрузке${hint ? `: ${hint.slice(0, 240)}` : ' (проверьте RAM и CUDA)'}`;
}

export function isRecoverableCudaLoadFailure(message: string): boolean {
  // CLI typos / unsupported flags are not CUDA problems — do not fall back to CPU.
  if (/invalid argument/i.test(message)) return false;
  return /GGML_ASSERT|CUDA|GPU|cudart|ggml-cuda/i.test(message);
}

function isServerAlive(session: ServerSession | null): session is ServerSession {
  return Boolean(session && session.process.exitCode == null && session.process.signalCode == null);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Flatten llama-server embedding payloads (OAI `/v1/embeddings` and legacy `/embeddings`). */
export function extractEmbeddingVector(payload: unknown): number[] | null {
  const flatten = (emb: unknown): number[] | null => {
    if (Array.isArray(emb) && emb.length > 0) {
      if (typeof emb[0] === 'number') return emb as number[];
      if (Array.isArray(emb[0])) {
        const rows = emb as number[][];
        // Pooled responses are often `[[...dims]]`; token-wise — take last row.
        const row = rows.length === 1 ? rows[0] : rows[rows.length - 1];
        if (Array.isArray(row) && row.length > 0 && typeof row[0] === 'number') return row;
      }
      return null;
    }
    if (emb && typeof emb === 'object' && !Array.isArray(emb)) {
      const values = Object.values(emb as Record<string, unknown>);
      if (values.length > 0 && values.every((n) => typeof n === 'number')) {
        return values as number[];
      }
    }
    return null;
  };

  const candidates: unknown[] = [];
  if (Array.isArray(payload)) {
    candidates.push(payload[0]);
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) candidates.push(obj.data[0]);
    candidates.push(obj);
  }

  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const flat = flatten((item as { embedding?: unknown }).embedding);
    if (flat?.length) return flat;
  }
  return null;
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
  recentLogs?: string[],
  usingCuda = false
): Promise<void> {
  const started = Date.now();
  let lastStatusAt = 0;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null || child.signalCode != null) {
      const hint = pickFatalServerLog(recentLogs ?? []);
      throw new Error(formatLlamaServerExitError(hint, usingCuda));
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
      // 503 Loading model — keep waiting; any other status is also "not ready yet".
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error('llama-server не ответил вовремя (проверьте RAM и настройки GPU)');
}

async function spawnLlamaServerProcess(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string | null,
  resources: AiResourceSettings,
  mode: 'embed' | 'chat',
  forceCpu: boolean,
  hooks?: LlamaServerHooks
): Promise<ServerSession> {
  const preferCuda = !forceCpu && (resources.gpuLayers ?? 0) > 0;
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
  const requestedLayers = Math.max(0, resources.gpuLayers ?? 0);
  const wantGpuLayers = usingCuda && requestedLayers > 0;
  /**
   * With mmproj, do NOT pin -ngl 999: --fit only adjusts *unset* args, so a forced 999
   * fills VRAM and vision encode silently falls back to CPU (50s+/image, ~0% GPU).
   * Let --fit pick layer count and keep --mmproj-offload + fit-target headroom.
   */
  const pinAllLayers = wantGpuLayers && !mmprojPath;
  const gpuLayers = !wantGpuLayers ? 0 : pinAllLayers ? (requestedLayers < 99 ? 999 : requestedLayers) : -1;
  const configKey = buildLlamaServerConfigKey(
    weightsPath,
    mmprojPath,
    mode,
    // Session key: treat fit/auto as 999 so we don't thrash restarts.
    wantGpuLayers ? 999 : 0
  );
  const port = await getFreePort();
  logAiIndexer('Запуск llama-server', {
    mode,
    port,
    gpuLayers: pinAllLayers ? gpuLayers : wantGpuLayers ? 'fit' : 0,
    requestedLayers,
    ctxSize,
    parallel: LLAMA_PARALLEL_SLOTS,
    usingCuda,
    forceCpu,
    mmproj: Boolean(mmprojPath),
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
    '-t',
    String(resources.threads ?? 4),
    '-c',
    String(ctxSize),
    '-np',
    String(LLAMA_PARALLEL_SLOTS)
  ];

  if (wantGpuLayers) {
    if (pinAllLayers) {
      args.push('-ngl', String(gpuLayers));
    }
    // fit adjusts unset -ngl so LLM + mmproj both stay on GPU.
    args.push('--fit', 'on', '--fit-target', String(LLAMA_FIT_TARGET_MIB));
  } else {
    args.push('-ngl', '0');
  }

  if (mmprojPath) {
    args.push(
      '--mmproj',
      mmprojPath,
      '--image-min-tokens',
      String(LLAMA_IMAGE_MIN_TOKENS),
      '--image-max-tokens',
      String(LLAMA_IMAGE_MAX_TOKENS)
    );
    // Default is offload-on; pin explicitly for CUDA vs CPU-fallback sessions.
    args.push(usingCuda && wantGpuLayers ? '--mmproj-offload' : '--no-mmproj-offload');
  } else {
    // Faster cold start when no vision projector.
    args.push('--no-warmup');
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
      PATH: `${runtimeDir}${path.delimiter}${pathEnv}`,
      // Pin marker so multimodal embedding prompts match without racing /props.
      ...(mmprojPath ? { LLAMA_MEDIA_MARKER: LLAMA_MEDIA_MARKER_DEFAULT } : {})
    }
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const recentLogs: string[] = [];

  child.stderr.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (!line) return;
    recentLogs.push(line.slice(0, 500));
    if (recentLogs.length > 20) recentLogs.shift();
    const snippet = line.slice(0, 500);
    logAiIndexer('llama-server', { line: snippet });
    // Surface GPU / vision placement — Task Manager "3D" can stay low while CUDA is busy or idle.
    if (/offloaded \d+\/\d+ layers to GPU/i.test(line)) {
      logAiIndexer('llama-server GPU layers', { line: snippet });
    }
    if (/mmproj|CLIP|clip/i.test(line) && /GPU|CUDA|CPU|offload|buffer/i.test(line)) {
      logAiIndexer('llama-server vision device', { line: snippet });
    }
    if (/no[- ]?mmproj[- ]?offload|mmproj.*CPU|failed to allocate.*(?:CLIP|mmproj)/i.test(line)) {
      logAiIndexer('llama-server vision likely on CPU', { line: snippet });
    }
  });

  child.on('exit', () => {
    if (startingChild === child) startingChild = null;
    if (serverSession?.process === child) {
      serverSession = null;
      serverConfigKey = null;
    }
  });

  startingChild = child;
  try {
    await waitForServerReady(baseUrl, child, 600_000, hooks, recentLogs, usingCuda);
  } catch (err) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    if (startingChild === child) startingChild = null;
    throw err;
  }

  if (startingChild === child) startingChild = null;
  const mediaMarker = mmprojPath
    ? await resolveServerMediaMarker(baseUrl, LLAMA_MEDIA_MARKER_DEFAULT)
    : LLAMA_MEDIA_MARKER_DEFAULT;
  const session: ServerSession = { process: child, port, baseUrl, mediaMarker };
  serverSession = session;
  serverConfigKey = configKey;
  return session;
}

export async function ensureLlamaServer(
  userDataPath: string,
  weightsPath: string,
  mmprojPath: string | null,
  resources: AiResourceSettings,
  mode: 'embed' | 'chat',
  hooks?: LlamaServerHooks
): Promise<ServerSession> {
  const logicalKey = buildLlamaServerLogicalKey(weightsPath, mmprojPath, mode);
  const wantGpu =
    (resources.gpuLayers ?? 0) > 0 && !cudaLoadFailedLogicalKeys.has(logicalKey);
  // Match spawnLlamaServerProcess: modest positive gpuLayers → full offload (999).
  const effectiveGpuLayers = wantGpu ? ((resources.gpuLayers ?? 0) < 99 ? 999 : (resources.gpuLayers ?? 0)) : 0;
  const preferredKey = buildLlamaServerConfigKey(weightsPath, mmprojPath, mode, effectiveGpuLayers);
  const cpuKey = buildLlamaServerConfigKey(weightsPath, mmprojPath, mode, 0);

  if (isServerAlive(serverSession)) {
    if (serverConfigKey === preferredKey) return serverSession;
    // Keep CPU-fallback session for the rest of this process when CUDA already failed,
    // or when the caller asked for CPU.
    if ((!wantGpu || cudaLoadFailedLogicalKeys.has(logicalKey)) && serverConfigKey === cpuKey) {
      return serverSession;
    }
  }

  if (ensureInflight?.logicalKey === logicalKey) {
    return ensureInflight.promise;
  }

  if (ensureInflight) {
    await shutdownLlamaServer();
    try {
      await ensureInflight.promise;
    } catch {
      /* previous startup cancelled or failed */
    }
  }

  const promise = (async (): Promise<ServerSession> => {
    await shutdownLlamaServer();
    try {
      const session = await spawnLlamaServerProcess(
        userDataPath,
        weightsPath,
        mmprojPath,
        resources,
        mode,
        !wantGpu,
        hooks
      );
      if (wantGpu) cudaLoadFailedLogicalKeys.delete(logicalKey);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (wantGpu && isRecoverableCudaLoadFailure(message)) {
        logAiIndexer('CUDA load failed, falling back to CPU', { error: message });
        hooks?.onStatus?.('CUDA недоступна, запуск на CPU…');
        cudaLoadFailedLogicalKeys.add(logicalKey);
        await shutdownLlamaServer();
        return spawnLlamaServerProcess(
          userDataPath,
          weightsPath,
          mmprojPath,
          { ...resources, gpuLayers: 0 },
          mode,
          true,
          hooks
        );
      }
      throw err;
    }
  })();

  ensureInflight = { logicalKey, promise };
  try {
    return await promise;
  } finally {
    if (ensureInflight?.promise === promise) ensureInflight = null;
  }
}

export async function shutdownLlamaServer(): Promise<void> {
  if (startingChild) {
    try {
      startingChild.kill();
    } catch {
      /* ignore */
    }
    startingChild = null;
  }
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

async function imageToRawBase64(imagePath: string): Promise<string> {
  const data = await readFile(imagePath);
  return data.toString('base64');
}

/** Build llama-server multimodal embedding input (not OpenAI image_url content parts). */
export function buildMultimodalEmbeddingInput(mediaMarker: string, imageBase64: string): unknown {
  const marker = mediaMarker.trim() || LLAMA_MEDIA_MARKER_DEFAULT;
  const raw = imageBase64.includes(',') ? imageBase64.slice(imageBase64.indexOf(',') + 1) : imageBase64;
  return [
    {
      prompt_string: marker,
      multimodal_data: [raw]
    }
  ];
}

async function resolveServerMediaMarker(baseUrl: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/props`);
    if (!res.ok) return fallback;
    const json = (await res.json()) as { media_marker?: unknown };
    if (typeof json.media_marker === 'string' && json.media_marker.trim()) {
      return json.media_marker.trim();
    }
  } catch {
    /* use fallback */
  }
  return fallback;
}

function isTransientLlamaFetchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const withCause = err as { cause?: unknown };
  const cause =
    withCause.cause instanceof Error
      ? withCause.cause.message
      : withCause.cause != null
        ? String(withCause.cause)
        : '';
  const text = `${message} ${cause}`;
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|other side closed|UND_ERR/i.test(
    text
  );
}

async function fetchLlamaEndpoint(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = '';
  let networkAttempt = 0;

  while (networkAttempt < LLAMA_NETWORK_RETRY_ATTEMPTS) {
    networkAttempt += 1;
    try {
      for (let attempt = 1; attempt <= MODEL_LOADING_RETRY_ATTEMPTS; attempt++) {
        const res = await undiciFetch(url, {
          method: init.method,
          headers: init.headers as Record<string, string> | undefined,
          body: init.body as string | Buffer | undefined,
          dispatcher: llamaFetchAgent
        });
        if (res.ok) return res as unknown as Response;
        const body = await res.text();
        lastStatus = res.status;
        lastBody = body;
        if (isLlamaModelLoadingResponse(res.status, body) && attempt < MODEL_LOADING_RETRY_ATTEMPTS) {
          logAiIndexer('llama-server ещё загружает модель, повтор', { label, attempt });
          await sleep(MODEL_LOADING_RETRY_MS);
          continue;
        }
        throw new Error(`${label} failed: ${res.status} ${body.slice(0, 200)}`);
      }
      throw new Error(`${label} failed: ${lastStatus} ${lastBody.slice(0, 200)}`);
    } catch (err) {
      if (
        isTransientLlamaFetchError(err) &&
        networkAttempt < LLAMA_NETWORK_RETRY_ATTEMPTS
      ) {
        logAiIndexer('llama-server сеть оборвалась, повтор запроса', {
          label,
          attempt: networkAttempt,
          error: err instanceof Error ? err.message : String(err)
        });
        await sleep(1500 * networkAttempt);
        continue;
      }
      if (err instanceof Error && err.message.startsWith(`${label} failed:`)) throw err;
      throw new Error(
        `${label} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  throw new Error(`${label} failed: ${lastStatus} ${lastBody.slice(0, 200)}`);
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
    const imageBase64 = await imageToRawBase64(vision.path);
    const multimodal = buildMultimodalEmbeddingInput(session.mediaMarker, imageBase64);
    let res: Response;
    try {
      res = await fetchLlamaEndpoint(
        `${session.baseUrl}/v1/embeddings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: multimodal,
            encoding_format: 'float'
          })
        },
        'embeddings(image)'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Older/native endpoint shape: content = { prompt_string, multimodal_data }.
      if (!/prompt.*elements|server_error|Failed to tokenize|500/i.test(message)) throw err;
      logAiIndexer('embeddings(image): fallback to /embeddings content shape', {
        error: message.slice(0, 160)
      });
      const item = Array.isArray(multimodal) ? multimodal[0] : multimodal;
      res = await fetchLlamaEndpoint(
        `${session.baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: item })
        },
        'embeddings(image)'
      );
    }

    const json: unknown = await res.json();
    const vector = extractEmbeddingVector(json);
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
  const res = await fetchLlamaEndpoint(
    `${session.baseUrl}/v1/embeddings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text.trim(), encoding_format: 'float' })
    },
    'embeddings(text)'
  );

  const json: unknown = await res.json();
  const vector = extractEmbeddingVector(json);
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

      const res = await fetchLlamaEndpoint(
        `${session.baseUrl}/v1/chat/completions`,
        {
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
        },
        'caption'
      );

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
