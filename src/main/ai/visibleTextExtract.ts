/**
 * Extract readable UI / on-image text during AI caption indexing (JoyCaption chat),
 * then merge into `ai_caption` for Qwen hybrid caption embeddings + literal boost.
 */

import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { generateJoyCaption } from './joyCaption';
import type { AiResourceSettings } from './types';
import {
  VISIBLE_TEXT_EXTRACT_PROMPT,
  normalizeVisibleText
} from './visibleTextExtractCore';

export {
  VISIBLE_TEXT_MARKER,
  VISIBLE_TEXT_EXTRACT_PROMPT,
  mergeCaptionWithVisibleText,
  normalizeVisibleText,
  stripVisibleTextBlock
} from './visibleTextExtractCore';

async function readResources(): Promise<AiResourceSettings> {
  const prefs = await readAppPreferences();
  return {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };
}

/** JoyCaption chat pass dedicated to on-image text (Qwen Embedding cannot generate). */
export async function extractVisibleTextFromImage(
  imagePath: string,
  onStatus?: (message: string) => void
): Promise<string> {
  const userData = app.getPath('userData');
  const resources = await readResources();
  const raw = await generateJoyCaption(
    userData,
    imagePath,
    resources,
    { onStatus },
    VISIBLE_TEXT_EXTRACT_PROMPT
  );
  return normalizeVisibleText(raw);
}
