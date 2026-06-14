import path from 'path';
import { existsSync } from 'fs';

import type { AiResourceSettings } from './types';
import { MODEL_CATALOG } from './types';
import { importEsm } from './esmImport';
import { resolveModelFilePaths } from './modelManager';

/** Проверка, что GGUF тяжёлой модели загружается в память (только main process — ESM). */
export async function verifyHeavyGgufLoad(
  modelsDir: string,
  resources: AiResourceSettings,
  userDataPath?: string
): Promise<void> {
  const entry = MODEL_CATALOG.heavy;
  const resolved = userDataPath
    ? resolveModelFilePaths(userDataPath, entry)
    : {
        weightsPath: entry.ggufFile ? path.join(modelsDir, 'llama', entry.ggufFile) : null,
        mmprojPath: entry.mmprojFile ? path.join(modelsDir, 'llama', entry.mmprojFile) : null
      };
  const ggufPath = resolved.weightsPath;
  if (!ggufPath || !existsSync(ggufPath)) {
    throw new Error('Файлы модели не найдены. Переустановите тяжёлую модель.');
  }

  const { getLlama } = await importEsm<typeof import('node-llama-cpp')>('node-llama-cpp');
  const llama = await getLlama('lastBuild');
  const model = await llama.loadModel({
    modelPath: ggufPath,
    gpuLayers: resources.gpuLayers ?? 0
  });
  await model.dispose();
}
