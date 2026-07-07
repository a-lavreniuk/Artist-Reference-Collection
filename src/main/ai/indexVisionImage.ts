import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import path from 'path';

import sharp from 'sharp';
import { app } from 'electron';

const VISION_SAFE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp']);

function visionCacheDir(): string {
  return path.join(app.getPath('userData'), 'ai-vision-cache');
}

/** llama-server не декодирует webp — отдаём jpeg/png во временный файл. */
export async function ensureVisionSafeImagePath(sourceAbs: string): Promise<{
  path: string;
  dispose: () => Promise<void>;
}> {
  const ext = path.extname(sourceAbs).toLowerCase();
  if (VISION_SAFE_EXT.has(ext) && existsSync(sourceAbs)) {
    return { path: sourceAbs, dispose: async () => {} };
  }

  const dir = visionCacheDir();
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  await sharp(sourceAbs).rotate().jpeg({ quality: 92 }).toFile(out);
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
