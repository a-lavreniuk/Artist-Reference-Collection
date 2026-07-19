import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { openLibraryDb } from '../storage/db';
import { cardDirAbs, thumbLRelPath } from '../storage/cardFolder';
import { extractVideoFrameToJpeg, probeVideoDurationMs } from '../ffmpeg';
import { videoFrameOffsetsMs } from './suggestTagsCore';

export type VisionFrames = {
  framePaths: string[];
  cleanup: () => Promise<void>;
};

export type ResolveVisionFramesOptions = {
  /** Префикс временных JPEG (чтобы автотег и caption не пересекались). */
  tempPrefix?: string;
};

/**
 * Изображение — оригинал; видео — до 3 JPEG-кадров (ffmpeg), иначе thumb_l.
 */
export async function resolveVisionFrames(
  libraryRoot: string,
  cardId: string,
  options: ResolveVisionFramesOptions = {}
): Promise<VisionFrames | { error: string }> {
  const tempPrefix = options.tempPrefix ?? '_ai_frame';
  const db = openLibraryDb(libraryRoot);
  const row = db.prepare('SELECT original_rel, type FROM cards WHERE id = ?').get(cardId) as
    | { original_rel?: string; type?: string }
    | undefined;
  if (!row?.original_rel) {
    return { error: 'Файл карточки не найден.' };
  }
  const originalAbs = path.join(libraryRoot, row.original_rel);
  if (!existsSync(originalAbs)) {
    return { error: 'Файл карточки недоступен на диске.' };
  }

  if (row.type === 'image') {
    return { framePaths: [originalAbs], cleanup: async () => undefined };
  }

  if (row.type !== 'video') {
    return { error: 'Доступно только для изображений и видео.' };
  }

  const dir = cardDirAbs(libraryRoot, cardId);
  const tempPaths: string[] = [];
  const durationMs = await probeVideoDurationMs(originalAbs);
  const offsets = videoFrameOffsetsMs(durationMs);

  for (const atMs of offsets) {
    const framePath = path.join(dir, `${tempPrefix}_${atMs}.jpg`);
    try {
      await extractVideoFrameToJpeg(originalAbs, framePath, { atMs });
      if (existsSync(framePath)) tempPaths.push(framePath);
    } catch {
      // следующий offset / fallback
    }
  }

  if (tempPaths.length === 0) {
    const thumbAbs = path.join(libraryRoot, thumbLRelPath(cardId));
    if (existsSync(thumbAbs)) {
      return { framePaths: [thumbAbs], cleanup: async () => undefined };
    }
    return {
      error: 'Не удалось извлечь кадр из видео. Проверьте, что ffmpeg доступен.'
    };
  }

  return {
    framePaths: tempPaths,
    cleanup: async () => {
      for (const p of tempPaths) {
        try {
          await unlink(p);
        } catch {
          /* ignore */
        }
      }
    }
  };
}
