import type { AiResourceSettings, ModelCatalogEntry, SearchModelId } from './types';
import { MODEL_CATALOG, SEARCH_ROLE_BY_ID, isSearchModelId } from './types';
import { resolveModelFilePaths } from './modelManager';
import {
  embedImageViaServer,
  embedTextViaServer,
  embedTextWithNodeLlama,
  resolveLlamaServerBinary
} from './llamaCppBridge';

function resolveEmbedEntry(modelId?: string): ModelCatalogEntry {
  if (modelId === 'qwen3-vl-embedding-8b') return MODEL_CATALOG['search-embed-8b'];
  if (modelId === 'qwen3-vl-embedding-2b' || !modelId) return MODEL_CATALOG['search-embed-2b'];
  if (isSearchModelId(modelId) && SEARCH_ROLE_BY_ID[modelId] !== 'search-clip') {
    return MODEL_CATALOG[SEARCH_ROLE_BY_ID[modelId as SearchModelId]];
  }
  return MODEL_CATALOG['search-embed-2b'];
}

export function isQwenSearchModelId(modelId: string): modelId is 'qwen3-vl-embedding-2b' | 'qwen3-vl-embedding-8b' {
  return modelId === 'qwen3-vl-embedding-2b' || modelId === 'qwen3-vl-embedding-8b';
}

export async function embedQwenImage(
  userDataPath: string,
  imagePath: string,
  resources: AiResourceSettings,
  modelId?: string
): Promise<number[]> {
  const entry = resolveEmbedEntry(modelId);
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath || !mmprojPath) {
    throw new Error(`Файлы ${entry.label} не найдены`);
  }

  if (resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return embedImageViaServer(userDataPath, weightsPath, mmprojPath, imagePath, resources);
  }

  throw new Error(
    'Для индексации изображений нужен llama-server. Переустановите модель поиска в настройках AI.'
  );
}

export async function embedQwenText(
  userDataPath: string,
  text: string,
  resources: AiResourceSettings,
  modelId?: string
): Promise<number[]> {
  const entry = resolveEmbedEntry(modelId);
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath) {
    throw new Error(`Файлы ${entry.label} не найдены`);
  }

  if (resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return embedTextViaServer(userDataPath, weightsPath, mmprojPath, text, resources);
  }

  return embedTextWithNodeLlama(weightsPath, text, resources);
}

export async function testQwenEmbedding(
  userDataPath: string,
  resources: AiResourceSettings,
  modelId?: string
): Promise<{
  ok: boolean;
  message: string;
  vectorDim?: number;
}> {
  try {
    const entry = resolveEmbedEntry(modelId);
    const vector = await embedQwenText(userDataPath, 'цветы', resources, entry.id);
    return { ok: true, message: `${entry.label}: embedding OK`, vectorDim: vector.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
