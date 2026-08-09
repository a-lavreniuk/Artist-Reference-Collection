import { app } from 'electron';
import path from 'node:path';

import { readAppPreferences } from '../appPreferences';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import { ensureLibraryReady, getCardByIdFromDb, updateCardInStorage } from '../storage/libraryStorage';
import { openLibraryDb } from '../storage/db';
import { captionForHeavyIndex } from './aiEmbeddingService';
import { generateJoyCaption } from './joyCaption';
import { buildIndexCaptionPrompt } from './joyCaptionPrompt';
import { isModelInstalled } from './modelManager';
import { mergeFrameCaptions } from './videoAiCaption';
import { resolveVisionFrames } from './visionFrames';

export type GenerateCardDescriptionResult =
  | { ok: true; description: string }
  | { ok: false; error: string };

/**
 * On-demand JoyCaption → user-facing `description` only (does not touch search `ai_caption`).
 */
export async function generateCardDescription(cardId: string): Promise<GenerateCardDescriptionResult> {
  const id = cardId.trim();
  if (!id) return { ok: false, error: 'Не указана карточка.' };

  const prefs = await readAppPreferences();
  if (!prefs.aiCaptionEnabled) {
    return { ok: false, error: 'Включите AI Описание в настройках.' };
  }

  const userData = app.getPath('userData');
  if (!(await isModelInstalled(userData, 'caption'))) {
    return {
      ok: false,
      error: 'Модель JoyCaption не установлена. Установите её в Настройки → AI → Описание.'
    };
  }

  const root = await readLibraryRootFromDisk();
  if (!root) return { ok: false, error: 'Библиотека не открыта.' };
  await ensureLibraryReady(root);

  const row = getCardByIdFromDb(root, id);
  if (!row) return { ok: false, error: 'Карточка не найдена.' };
  if (row.type !== 'image' && row.type !== 'video') {
    return { ok: false, error: 'Описание можно сгенерировать только для изображения или видео.' };
  }

  let text = '';
  try {
    if (row.type === 'image') {
      if (!row.originalRel) return { ok: false, error: 'У карточки нет файла.' };
      const imagePath = path.join(root, row.originalRel);
      text = (await captionForHeavyIndex(imagePath)).trim();
    } else {
      const vision = await resolveVisionFrames(root, id, { tempPrefix: '_desc_frame' });
      if ('error' in vision) return { ok: false, error: vision.error };

      const resources = {
        threads: prefs.aiThreads,
        gpuLayers: prefs.aiGpuLayers,
        maxRamMb: prefs.aiMaxRamMb
      };
      const prompt = buildIndexCaptionPrompt(prefs);
      const perFrame: string[] = [];
      try {
        for (const framePath of vision.framePaths) {
          const caption = await generateJoyCaption(userData, framePath, resources, undefined, prompt);
          if (caption.trim()) perFrame.push(caption.trim());
        }
      } finally {
        await vision.cleanup();
      }
      text = mergeFrameCaptions(perFrame);
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|fetch failed|caption failed/i.test(raw)) {
      return {
        ok: false,
        error: 'Модель сейчас занята или не отвечает. Подождите и попробуйте снова.'
      };
    }
    return { ok: false, error: raw };
  }

  if (!text) {
    return { ok: false, error: 'Модель не вернула описание.' };
  }

  openLibraryDb(root);
  await updateCardInStorage(root, id, { description: text });
  return { ok: true, description: text };
}
