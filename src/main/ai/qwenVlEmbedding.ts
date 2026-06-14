import type { AiResourceSettings, ModelCatalogEntry } from './types';
import { resolveModelFilePaths } from './modelManager';
import {
  embedImageViaServer,
  embedTextViaServer,
  embedTextWithNodeLlama,
  resolveLlamaServerBinary
} from './llamaCppBridge';

/** Legacy Qwen medium catalog (tier removed from product; kept for optional migration tooling). */
const QWEN_MEDIUM_ENTRY: ModelCatalogEntry = {
  id: 'qwen3-vl-embedding-2b',
  tier: 'heavy',
  stack: 'llama-embed',
  hfId: 'DevQuasar/Qwen.Qwen3-VL-Embedding-2B-GGUF',
  catalogRevision: 1,
  label: 'Qwen3-VL-Embedding',
  description: 'Legacy medium tier',
  sizeLabel: '~2.5 ГБ',
  sizeMb: 2500,
  minRamMb: 8192,
  files: [
    { name: 'Qwen.Qwen3-VL-Embedding-2B.Q4_K_M.gguf', role: 'weights' },
    { name: 'mmproj-Qwen.Qwen3-VL-Embedding-2B.f16.gguf', role: 'mmproj' }
  ]
};

export async function embedQwenImage(
  userDataPath: string,
  imagePath: string,
  resources: AiResourceSettings
): Promise<number[]> {
  const entry = QWEN_MEDIUM_ENTRY;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath || !mmprojPath) {
    throw new Error('Файлы Qwen3-VL-Embedding не найдены');
  }

  if (resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return embedImageViaServer(userDataPath, weightsPath, mmprojPath, imagePath, resources);
  }

  throw new Error(
    'Для индексации изображений нужен llama-server. Переустановите тяжёлую модель в настройках AI Поиска.'
  );
}

export async function embedQwenText(
  userDataPath: string,
  text: string,
  resources: AiResourceSettings
): Promise<number[]> {
  const entry = QWEN_MEDIUM_ENTRY;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath) {
    throw new Error('Файлы Qwen3-VL-Embedding не найдены');
  }

  if (resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return embedTextViaServer(userDataPath, weightsPath, mmprojPath, text, resources);
  }

  return embedTextWithNodeLlama(weightsPath, text, resources);
}

export async function testQwenEmbedding(userDataPath: string, resources: AiResourceSettings): Promise<{
  ok: boolean;
  message: string;
  vectorDim?: number;
}> {
  try {
    const vector = await embedQwenText(userDataPath, 'цветы', resources);
    return { ok: true, message: 'Qwen embedding OK', vectorDim: vector.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
