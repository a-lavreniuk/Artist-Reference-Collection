import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import type { AiResourceSettings, ModelTier } from './types';
import { MODEL_CATALOG } from './types';
import { embedImageInWorker, embedTextInWorker, getModelsDir, initAiWorker, downloadModelInWorker } from './aiWorkerBridge';
import { isModelInstalled, hasModelArtifactsOnDisk } from './modelManager';
import { recordInstalledModel } from './modelManifest';
import { generateJoyCaption } from './joyCaption';
import { buildIndexCaptionPrompt } from './joyCaptionPrompt';
import { prepareSearchQuery } from './queryPrep';

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

  if (!(await isModelInstalled(userData, 'light'))) {
    if (!options?.allowDownload) {
      throw new Error('Лёгкая модель не установлена. Скачайте её в настройках AI Поиска.');
    }
    await downloadModelInWorker('light', modelsDir, resources, onProgress);
    if (!(await hasModelArtifactsOnDisk(userData, 'light'))) {
      throw new Error('Файлы лёгкой модели не найдены после загрузки. Попробуйте ещё раз.');
    }
    await recordInstalledModel(userData, 'light', MODEL_CATALOG.light, MODEL_CATALOG.light.hfRevision ?? 'main');
  }

  const loaded = await initAiWorker('light', modelsDir, resources);
  return loaded.modelId;
}

async function ensureClipWorker(): Promise<string> {
  return ensureLightClipForHybrid();
}

export async function embedImageForTier(
  tier: ModelTier,
  imagePath: string,
  modelId: string
): Promise<number[]> {
  if (tier === 'heavy') {
    throw new Error('Heavy tier uses hybrid indexing; call embedHeavyHybridForIndex instead.');
  }

  return embedImageInWorker(imagePath, modelId);
}

export async function embedTextForTier(
  tier: ModelTier,
  text: string,
  modelId: string,
  modelsDir: string
): Promise<number[]> {
  if (tier === 'heavy') {
    throw new Error('Heavy tier uses hybrid search; call embedHeavyHybridQuery instead.');
  }

  const prepared = await prepareSearchQuery(text, modelsDir);
  return embedTextInWorker(prepared, modelId);
}

export async function embedHeavyHybridForIndex(
  imagePath: string,
  caption: string,
  tagNames: string[]
): Promise<{ visual: number[]; caption: number[] }> {
  const modelsDir = getModelsDir();
  const lightId = await ensureClipWorker();
  const visual = await embedImageInWorker(imagePath, lightId);
  const captionText = [caption, ...tagNames].filter(Boolean).join('\n');
  const prepared = await prepareSearchQuery(captionText, modelsDir);
  const captionVector = await embedTextInWorker(prepared, lightId);
  return { visual, caption: captionVector };
}

export async function embedHeavyHybridQuery(
  query: string,
  modelsDir: string
): Promise<{ visual: number[]; caption: number[] }> {
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

export function clipModelId(): string {
  return MODEL_CATALOG.light.id;
}
