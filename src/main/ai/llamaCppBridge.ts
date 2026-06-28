import { readFile } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createServer } from 'net';
import path from 'path';

import type { AiResourceSettings } from './types';
import { importEsm } from './esmImport';
import { resolveLlamaServerBinaryFromUserData } from './llamaRuntime';
import { ensureVisionSafeImagePath } from './indexVisionImage';
import { logAiIndexer } from './aiIndexerLog';

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
  'Write a descriptive caption for this image in plain English. Describe the subject, colors, composition, style, and mood in one concise paragraph.';

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

async function waitForServerReady(
  baseUrl: string,
  timeoutMs = 600_000,
  hooks?: LlamaServerHooks
): Promise<void> {
  const started = Date.now();
  let lastStatusAt = 0;
  while (Date.now() - started < timeoutMs) {
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
  const binary = resolveLlamaServerBinary(userDataPath, preferCuda);
  if (!binary) {
    throw new Error(
      'llama-server не найден. Переустановите тяжёлую модель в настройках AI Поиска.'
    );
  }

  const port = await getFreePort();
  logAiIndexer('Запуск llama-server', { mode, port, gpuLayers: resources.gpuLayers ?? 0 });
  hooks?.onStatus?.('Запуск llama-server…');
  const args = [
    '-m',
    weightsPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-ngl',
    String(resources.gpuLayers ?? 0),
    '-t',
    String(resources.threads ?? 4)
  ];

  if (mmprojPath) {
    args.push('--mmproj', mmprojPath);
  }

  if (mode === 'embed') {
    args.push('--embedding', '--pooling', 'last');
  }

  const child = spawn(binary, args, { stdio: 'pipe', windowsHide: true });
  const baseUrl = `http://127.0.0.1:${port}`;

  child.stderr.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (!line) return;
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
  await waitForServerReady(baseUrl, 600_000, hooks);
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
        max_tokens: 512
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
}

export async function shutdownLlamaBridge(): Promise<void> {
  await shutdownLlamaServer();
  await disposeQwenTextEmbedder();
}

export { JOYCAPTION_INDEX_PROMPT };
