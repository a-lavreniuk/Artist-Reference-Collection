import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import path from 'path';

import sharp from 'sharp';
import { app } from 'electron';

/** Long edge cap — smaller images keep mmproj on GPU and cut encode time. */
export const VISION_MAX_EDGE_PX = 768;

function visionCacheDir(): string {
  return path.join(app.getPath('userData'), 'ai-vision-cache');
}

/**
 * Always produce a downscaled JPEG for llama-server mtmd.
 * WebP/GIF and huge originals otherwise take many minutes per card (or kill the client fetch).
 */
export async function ensureVisionSafeImagePath(sourceAbs: string): Promise<{
  path: string;
  dispose: () => Promise<void>;
}> {
  if (!existsSync(sourceAbs)) {
    throw new Error(`Файл изображения не найден: ${sourceAbs}`);
  }

  const dir = visionCacheDir();
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  await sharp(sourceAbs)
    .rotate()
    .resize({
      width: VISION_MAX_EDGE_PX,
      height: VISION_MAX_EDGE_PX,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(out);

  return {
    path: out,
    dispose: async () => {
      try {
        await rm(out, { force: true });
      } catch {
        /* ignore */
      }
    }
  };
}
