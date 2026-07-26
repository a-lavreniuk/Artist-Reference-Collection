import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import type { AiResourceSettings, SearchModelId } from './types';
import { MODEL_CATALOG } from './types';
import {
  embedImageInWorker,
  embedTextInWorker,
  getModelsDir,
  initAiWorker,
  downloadModelInWorker
} from './aiWorkerBridge';
import { isModelInstalled, hasModelArtifactsOnDisk } from './modelManager';
import { recordInstalledModel } from './modelManifest';
import { generateJoyCaption } from './joyCaption';
import { buildIndexCaptionPrompt } from './joyCaptionPrompt';
import { prepareSearchQuery, prepareSearchQueryRaw } from './queryPrep';
import { embedQwenImage, embedQwenText, isQwenSearchModelId } from './qwenVlEmbedding';

async function readResources(): Promise<AiResourceSettings> {
  const prefs = await readAppPreferences();
  return {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };
}

export async function ensureLightClipForHybrid(
  onProgress?: (info: number | { percent: number; bytesReceived?: number; bytesTotal?: number }) => void,
  options?: { allowDownload?: boolean }
): Promise<string> {
  const userData = app.getPath('userData');
  const resources = await readResources();
  const modelsDir = getModelsDir();
  const entry = MODEL_CATALOG['search-clip'];

  if (!(await isModelInstalled(userData, 'search-clip'))) {
    if (!options?.allowDownload) {
      throw new Error('Лёгкая модель не установлена. Скачайте её в настройках AI.');
    }
    await downloadModelInWorker('search-clip', modelsDir, resources, onProgress);
    if (!(await hasModelArtifactsOnDisk(userData, 'search-clip'))) {
      throw new Error('Файлы лёгкой модели не найдены после загрузки. Попробуйте ещё раз.');
    }
    await recordInstalledModel(userData, 'search-clip', entry, entry.hfRevision ?? 'main');
  }

  const loaded = await initAiWorker('search-clip', modelsDir, resources);
  return loaded.modelId;
}

async function ensureClipWorker(): Promise<string> {
  return ensureLightClipForHybrid();
}

export function clipModelId(): string {
  return MODEL_CATALOG['search-clip'].id;
}

export function isQwenSearchModel(modelId: string): boolean {
  return isQwenSearchModelId(modelId);
}

export async function embedSearchImage(modelId: SearchModelId, imagePath: string): Promise<number[]> {
  if (modelId === 'clip-vit-base-patch32') {
    await ensureClipWorker();
    return embedImageInWorker(imagePath, modelId);
  }
  const userData = app.getPath('userData');
  const resources = await readResources();
  return embedQwenImage(userData, imagePath, resources, modelId);
}

export async function embedSearchText(
  modelId: SearchModelId,
  text: string,
  modelsDir: string
): Promise<number[]> {
  if (modelId === 'clip-vit-base-patch32') {
    await ensureClipWorker();
    const prepared = await prepareSearchQuery(text, modelsDir);
    return embedTextInWorker(prepared, modelId);
  }
  const userData = app.getPath('userData');
  const resources = await readResources();
  return embedQwenText(userData, prepareSearchQueryRaw(text), resources, modelId);
}

/** @deprecated Prefer embedSearchImage */
export async function embedImageForTier(
  _tier: 'light' | 'heavy',
  imagePath: string,
  modelId: string
): Promise<number[]> {
  if (isQwenSearchModelId(modelId)) {
    return embedSearchImage(modelId as SearchModelId, imagePath);
  }
  return embedSearchImage('clip-vit-base-patch32', imagePath);
}

/** @deprecated Prefer embedSearchText */
export async function embedTextForTier(
  _tier: 'light' | 'heavy',
  text: string,
  modelId: string,
  modelsDir: string
): Promise<number[]> {
  if (isQwenSearchModelId(modelId)) {
    return embedSearchText(modelId as SearchModelId, text, modelsDir);
  }
  return embedSearchText('clip-vit-base-patch32', text, modelsDir);
}

/**
 * Hybrid index for Qwen search + captions: visual = image embed, caption = text embed of caption+tags.
 * CLIP path keeps previous CLIP visual + CLIP caption text embeds.
 */
export async function embedHeavyHybridForIndex(
  imagePath: string,
  caption: string,
  tagNames: string[],
  searchModelId?: SearchModelId
): Promise<{ visual: number[]; caption: number[] }> {
  const modelsDir = getModelsDir();
  const prefs = await readAppPreferences();
  const modelId = searchModelId ?? prefs.aiSearchModelId ?? 'clip-vit-base-patch32';
  const captionText = [caption, ...tagNames].filter(Boolean).join('\n');

  if (isQwenSearchModelId(modelId)) {
    const userData = app.getPath('userData');
    const resources = await readResources();
    const visual = await embedQwenImage(userData, imagePath, resources, modelId);
    const captionVector = await embedQwenText(userData, captionText, resources, modelId);
    return { visual, caption: captionVector };
  }

  const lightId = await ensureClipWorker();
  const visual = await embedImageInWorker(imagePath, lightId);
  const prepared = await prepareSearchQuery(captionText, modelsDir);
  const captionVector = await embedTextInWorker(prepared, lightId);
  return { visual, caption: captionVector };
}

export async function embedHeavyHybridQuery(
  query: string,
  modelsDir: string,
  searchModelId?: SearchModelId
): Promise<{ visual: number[]; caption: number[] }> {
  const prefs = await readAppPreferences();
  const modelId = searchModelId ?? prefs.aiSearchModelId ?? 'clip-vit-base-patch32';

  if (isQwenSearchModelId(modelId)) {
    const userData = app.getPath('userData');
    const resources = await readResources();
    const vector = await embedQwenText(userData, query, resources, modelId);
    return { visual: vector, caption: vector };
  }

  const lightId = await ensureClipWorker();
  const prepared = await prepareSearchQuery(query, modelsDir);
  const visual = await embedTextInWorker(prepared, lightId);
  const caption = await embedTextInWorker(prepared, lightId);
  return { visual, caption };
}

export async function captionForHeavyIndex(
  imagePath: string,
  onStatus?: (message: string) => void
): Promise<string> {
  const userData = app.getPath('userData');
  const prefs = await readAppPreferences();
  const resources = await readResources();
  const prompt = buildIndexCaptionPrompt(prefs);
  return generateJoyCaption(userData, imagePath, resources, { onStatus }, prompt);
}
