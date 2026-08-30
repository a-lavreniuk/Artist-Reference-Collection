/**
 * AI worker entry point — runs inside Electron UtilityProcess.
 * Только search-clip (CLIP transformers).
 */

import path from 'path';

import type { AiResourceSettings, ModelRole, WorkerRequest, WorkerResponse } from './types';
import { MODEL_CATALOG } from './types';
import { prepareSearchQuery } from './queryPrep';
import { createHfDownloadProgressAggregator } from './hfDownloadProgress';

type EmbedFn = (input: string) => Promise<number[]>;
type TensorLike = { data: Float32Array | Float32Array[] };

let activeRole: ModelRole | null = null;
let activeModelId: string | null = null;
let activeModelsDir: string | null = null;
let embedImage: EmbedFn | null = null;
let embedText: EmbedFn | null = null;
let downloadAborted = false;
let downloadPaused = false;
const CLIP_ESTIMATED_BYTES = MODEL_CATALOG['search-clip'].sizeMb * 1024 * 1024;

function post(msg: WorkerResponse): void {
  process.parentPort?.postMessage(msg);
}

function tensorToVector(tensor: TensorLike): number[] {
  const data = Array.isArray(tensor.data) ? tensor.data[0] : tensor.data;
  return Array.from(data);
}

async function loadClipEmbedders(
  role: ModelRole,
  hfId: string,
  modelsDir: string,
  options: { allowRemote: boolean }
): Promise<{ modelId: string; embedImage: EmbedFn; embedText: EmbedFn }> {
  const entry = MODEL_CATALOG[role];
  const transformers = await import('@xenova/transformers');
  const { env, pipeline, AutoTokenizer, CLIPTextModelWithProjection } = transformers;

  env.cacheDir = path.join(modelsDir, 'transformers');
  env.allowLocalModels = true;
  env.allowRemoteModels = options.allowRemote;
  env.useBrowserCache = false;

  const clipProgress = createHfDownloadProgressAggregator(CLIP_ESTIMATED_BYTES);
  const progressCallback = (progress: {
    status?: string;
    file?: string;
    name?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => {
    if (!options.allowRemote || downloadAborted || downloadPaused) return;
    const result = clipProgress.ingest(progress);
    post({
      type: 'download-progress',
      role,
      percent: result.percent,
      bytesReceived: result.bytesReceived,
      bytesTotal: result.bytesTotal
    });
  };

  const localOnly = !options.allowRemote;
  const modelOptions = {
    quantized: true as const,
    ...(localOnly ? { local_files_only: true as const } : { progress_callback: progressCallback })
  };

  const imagePipe = await pipeline('image-feature-extraction', hfId, modelOptions);

  const tokenizer = await AutoTokenizer.from_pretrained(hfId, modelOptions);
  const textModel = await CLIPTextModelWithProjection.from_pretrained(hfId, modelOptions);
  if (options.allowRemote) {
    post({ type: 'download-progress', role, percent: 100 });
  }

  return {
    modelId: entry.id,
    embedImage: async (imagePath: string) => {
      const out = (await imagePipe(imagePath, {
        pooling: 'mean',
        normalize: true
      } as Record<string, unknown>)) as TensorLike;
      return tensorToVector(out);
    },
    embedText: async (text: string) => {
      const prepared = await prepareSearchQuery(text, modelsDir);
      const inputs = await tokenizer([prepared], { padding: true, truncation: true });
      const out = await textModel(inputs);
      return tensorToVector(out.text_embeds as TensorLike);
    }
  };
}

async function handleInit(req: Extract<WorkerRequest, { type: 'init' }>): Promise<void> {
  await unloadModels();
  downloadAborted = false;
  activeModelsDir = req.modelsDir;

  const entry = MODEL_CATALOG[req.role];
  if (entry.stack !== 'transformers' || req.role !== 'search-clip') {
    post({
      type: 'ready',
      modelId: entry.id,
      role: req.role
    });
    activeRole = req.role;
    activeModelId = entry.id;
    return;
  }

  const loaded = await loadClipEmbedders(req.role, entry.hfId, req.modelsDir, { allowRemote: false });
  activeRole = req.role;
  activeModelId = loaded.modelId;
  embedImage = loaded.embedImage;
  embedText = loaded.embedText;
  post({ type: 'ready', modelId: loaded.modelId, role: req.role });
}

async function handleDownload(req: Extract<WorkerRequest, { type: 'download-model' }>): Promise<void> {
  downloadAborted = false;
  try {
    if (req.role !== 'search-clip') {
      post({
        type: 'download-complete',
        role: req.role,
        modelId: MODEL_CATALOG[req.role].id
      });
      return;
    }
    const loaded = await loadClipEmbedders(req.role, MODEL_CATALOG[req.role].hfId, req.modelsDir, {
      allowRemote: true
    });
    activeRole = req.role;
    activeModelId = loaded.modelId;
    embedImage = loaded.embedImage;
    embedText = loaded.embedText;
    post({
      type: 'download-complete',
      role: req.role,
      modelId: loaded.modelId
    });
  } catch (err) {
    if (downloadAborted) return;
    post({
      type: 'download-error',
      role: req.role,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

async function handleTestModel(req: Extract<WorkerRequest, { type: 'test-model' }>): Promise<void> {
  try {
    if (req.role !== 'search-clip') {
      post({
        type: 'test-result',
        role: req.role,
        ok: true,
        message: 'Проверка выполняется в основном процессе.'
      });
      return;
    }
    await handleInit({
      type: 'init',
      role: req.role,
      modelsDir: req.modelsDir,
      resources: req.resources
    });
    if (!embedText) {
      post({
        type: 'test-result',
        role: req.role,
        ok: false,
        message: 'Не удалось загрузить модель. Попробуйте перезагрузить.'
      });
      return;
    }
    const vector = await embedText('цветы');
    post({
      type: 'test-result',
      role: req.role,
      ok: vector.length > 0,
      message: 'Лёгкая модель работает. Поиск по изображениям готов.',
      vectorDim: vector.length
    });
  } catch (err) {
    post({
      type: 'test-result',
      role: req.role,
      ok: false,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

async function unloadModels(): Promise<void> {
  embedImage = null;
  embedText = null;
  activeRole = null;
  activeModelId = null;
  activeModelsDir = null;
}

process.parentPort?.on('message', (event: { data: WorkerRequest }) => {
  const msg = event.data;
  void (async () => {
    try {
      switch (msg.type) {
        case 'ping':
          post({ type: 'pong' });
          break;
        case 'init':
          await handleInit(msg);
          break;
        case 'download-model':
          await handleDownload(msg);
          break;
        case 'test-model':
          await handleTestModel(msg);
          break;
        case 'cancel-download':
          downloadAborted = true;
          downloadPaused = false;
          break;
        case 'pause-download':
          downloadPaused = true;
          break;
        case 'resume-download':
          downloadPaused = false;
          break;
        case 'unload':
          await unloadModels();
          break;
        case 'embed-image': {
          if (!embedImage) {
            post({ type: 'error', message: 'Модель не загружена', recoverable: true });
            return;
          }
          const vector = await embedImage(msg.imagePath);
          post({ type: 'embedding', requestType: 'embed-image', vector });
          break;
        }
        case 'embed-text': {
          if (!embedText) {
            post({ type: 'error', message: 'Модель не загружена', recoverable: true });
            return;
          }
          const vector = await embedText(msg.text);
          post({ type: 'embedding', requestType: 'embed-text', vector });
          break;
        }
        default:
          post({ type: 'error', message: 'Неизвестная команда worker' });
      }
    } catch (err) {
      post({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
        recoverable: true
      });
    }
  })();
});

post({ type: 'pong' });
