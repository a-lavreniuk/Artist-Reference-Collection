import { existsSync } from 'fs';
import type { AiResourceSettings } from './types';
import { MODEL_CATALOG } from './types';
import { resolveModelFilePaths } from './modelManager';
import { captionImageViaServer, resolveLlamaServerBinary, type LlamaServerHooks } from './llamaCppBridge';

export async function generateJoyCaption(
  userDataPath: string,
  imagePath: string,
  resources: AiResourceSettings,
  hooks?: LlamaServerHooks,
  prompt?: string
): Promise<string> {
  const entry = MODEL_CATALOG.caption;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath || !existsSync(weightsPath) || !mmprojPath || !existsSync(mmprojPath)) {
    throw new Error('Файлы JoyCaption не найдены');
  }
  if (!resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    throw new Error(
      'Для JoyCaption нужен llama-server. Переустановите модель в Настройки → Автотеги.'
    );
  }
  return captionImageViaServer(
    userDataPath,
    weightsPath,
    mmprojPath,
    imagePath,
    resources,
    prompt,
    hooks
  );
}

export async function testJoyCaptionLoad(
  userDataPath: string,
  resources: AiResourceSettings
): Promise<{ ok: boolean; message: string }> {
  const entry = MODEL_CATALOG.caption;
  const { weightsPath, mmprojPath } = resolveModelFilePaths(userDataPath, entry);
  if (!weightsPath || !existsSync(weightsPath)) {
    return { ok: false, message: 'Файлы модели автотегов не найдены. Установите её в этом разделе.' };
  }
  if (!mmprojPath || !existsSync(mmprojPath)) {
    return { ok: false, message: 'Файлы модели автотегов не найдены. Установите её в этом разделе.' };
  }
  if (!resolveLlamaServerBinary(userDataPath, (resources.gpuLayers ?? 0) > 0)) {
    return {
      ok: false,
      message: 'Среда для модели автотегов не установлена. Установите модель в Настройки → Автотеги.'
    };
  }
  return { ok: true, message: 'Модель автотегов на месте. При первом запуске загрузка в память может занять несколько минут.' };
}
