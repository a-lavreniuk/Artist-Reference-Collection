import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import { ensureLibraryReady, getCardByIdFromDb } from '../storage/libraryStorage';
import { openLibraryDb } from '../storage/db';
import { upsertCardAiCaption } from '../storage/cardAiCaption';
import { upsertCardAiCaptionFts } from '../storage/cardFts';
import { notifyRendererExtensionImport } from '../importApi/notifyRenderer';
import { isModelInstalled } from './modelManager';
import { generateJoyCaption } from './joyCaption';
import { buildIndexCaptionPrompt } from './joyCaptionPrompt';
import { resolveVisionFrames } from './visionFrames';

/**
 * Склеивает подписи с нескольких кадров в одно связное AI-описание.
 * Близкие дубликаты отбрасываются; порядок кадров сохраняется.
 */
export function mergeFrameCaptions(parts: string[]): string {
  const cleaned = parts
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter((p) => p.length >= 8);

  const normKey = (s: string) => s.toLowerCase().replace(/[.!?…]+$/u, '').trim();

  const unique: string[] = [];
  for (const part of cleaned) {
    const key = normKey(part);
    const nearDup = unique.findIndex((u) => {
      const uk = normKey(u);
      return uk === key || uk.includes(key) || key.includes(uk);
    });
    if (nearDup >= 0) {
      if (part.length > unique[nearDup].length) unique[nearDup] = part;
      continue;
    }
    unique.push(part);
  }

  if (unique.length === 0) return '';
  if (unique.length === 1) {
    const one = unique[0];
    return /[.!?…]$/u.test(one) ? one : `${one}.`;
  }

  return unique
    .map((p) => {
      const body = p.replace(/[.!?…]+$/u, '').trim();
      return `${body}.`;
    })
    .join(' ');
}

export async function generateAndStoreVideoAiCaption(
  cardId: string
): Promise<{ ok: true; caption: string } | { ok: false; error: string }> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled) {
    return { ok: false, error: 'Включите AI Поиск в настройках.' };
  }

  const userData = app.getPath('userData');
  if (!(await isModelInstalled(userData, 'heavy'))) {
    return {
      ok: false,
      error: 'Нужна тяжёлая модель (JoyCaption). Установите её в Настройки → AI Поиск.'
    };
  }

  const root = await readLibraryRootFromDisk();
  if (!root) return { ok: false, error: 'Библиотека не открыта.' };
  await ensureLibraryReady(root);

  const row = getCardByIdFromDb(root, cardId);
  if (!row || row.type !== 'video') {
    return { ok: false, error: 'AI описание по кадрам доступно только для видео.' };
  }

  const vision = await resolveVisionFrames(root, cardId, { tempPrefix: '_caption_frame' });
  if ('error' in vision) return { ok: false, error: vision.error };

  const { waitForNavigationIpc } = await import('../ipcNavigationPriority');
  await waitForNavigationIpc();

  const resources = {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };
  const prompt = buildIndexCaptionPrompt(prefs);

  const perFrame: string[] = [];
  try {
    for (const framePath of vision.framePaths) {
      try {
        const caption = await generateJoyCaption(userData, framePath, resources, undefined, prompt);
        if (caption.trim()) perFrame.push(caption.trim());
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (/ECONNREFUSED|fetch failed|caption failed/i.test(raw)) {
          return {
            ok: false,
            error:
              'Модель сейчас занята или не отвечает. Подождите окончания индексации и попробуйте снова.'
          };
        }
        return { ok: false, error: raw };
      }
    }
  } finally {
    await vision.cleanup();
  }

  const merged = mergeFrameCaptions(perFrame);
  if (!merged) {
    return { ok: false, error: 'Модель не вернула описание ни по одному кадру.' };
  }

  const db = openLibraryDb(root);
  upsertCardAiCaption(db, cardId, merged);
  upsertCardAiCaptionFts(db, cardId, merged);
  notifyRendererExtensionImport([cardId], { quiet: true });

  return { ok: true, caption: merged };
}

/**
 * После импорта видео: AI-описание из суммы кадров (если включено в настройках).
 */
export async function applyVideoCaptionsAfterImport(cardIds: string[]): Promise<number> {
  const prefs = await readAppPreferences();
  if (!prefs.aiVideoCaptionOnImport) return 0;
  if (!(await isModelInstalled(app.getPath('userData'), 'heavy'))) return 0;

  const root = await readLibraryRootFromDisk();
  if (!root) return 0;

  let done = 0;
  for (const cardId of [...new Set(cardIds.filter(Boolean))]) {
    const row = getCardByIdFromDb(root, cardId);
    if (!row || row.type !== 'video') continue;
    if (row.aiCaption?.trim()) continue;
    try {
      const res = await generateAndStoreVideoAiCaption(cardId);
      if (res.ok) done += 1;
    } catch {
      /* не блокируем импорт */
    }
  }
  return done;
}
