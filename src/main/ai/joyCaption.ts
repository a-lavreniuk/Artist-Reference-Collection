import type { AiResourceSettings } from './types';
import { MODEL_CATALOG } from './types';
import { resolveModelFilePaths } from './modelManager';
import { captionImageViaServer, resolveLlamaServerBinary } from './llamaCppBridge';

export async function generateJoyCaption(
  userDataPath: string,
  imagePath: string,
  resources: AiResourceSettings
): Promise<string> {
  const entry = MODEL_CATALOG.heavy;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath || !mmprojPath) {
    throw new Error('Файлы JoyCaption не найдены');
  }
  if (!resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    throw new Error(
      'Для JoyCaption нужен llama-server. Переустановите heavy модель в настройках AI Поиска.'
    );
  }
  return captionImageViaServer(userDataPath, weightsPath, mmprojPath, imagePath, resources);
}

export async function testJoyCaptionLoad(
  userDataPath: string,
  resources: AiResourceSettings
): Promise<{ ok: boolean; message: string }> {
  const entry = MODEL_CATALOG.heavy;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath) {
    return { ok: false, message: 'Файлы модели не найдены. Переустановите тяжёлую модель.' };
  }
  if (!mmprojPath) {
    return { ok: false, message: 'Файлы модели не найдены. Переустановите тяжёлую модель.' };
  }
  if (!resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return {
      ok: false,
      message: 'Среда для тяжёлой модели не установлена. Переустановите модель в настройках AI Поиска.'
    };
  }
  return { ok: true, message: 'Тяжёлая модель работает. Можно запускать индексацию.' };
}
