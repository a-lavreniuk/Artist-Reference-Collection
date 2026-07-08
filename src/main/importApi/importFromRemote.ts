import crypto from 'crypto';
import { unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { assembleHlsToMp4, isVideoExt } from '../ffmpeg';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

const HLS_CONTENT_TYPES = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl']);

/** HLS-плейлист определяем по расширению `.m3u8` или по Content-Type. */
export function isHlsUrl(url: string, contentType?: string | null): boolean {
  try {
    if (new URL(url).pathname.toLowerCase().endsWith('.m3u8')) return true;
  } catch {
    /* ignore */
  }
  const ct = contentType?.split(';')[0]?.trim().toLowerCase();
  return ct ? HLS_CONTENT_TYPES.has(ct) : false;
}

async function downloadHlsToTempFile(
  url: string,
  maxBytes: number
): Promise<{ tempPath: string; cleanup: () => Promise<void> }> {
  const tempPath = path.join(os.tmpdir(), `arc-ext-import-${crypto.randomUUID()}.mp4`);
  const cleanup = async () => {
    try {
      await unlink(tempPath);
    } catch {
      /* ignore */
    }
  };
  try {
    await assembleHlsToMp4(url, tempPath, maxBytes);
  } catch (e) {
    await cleanup();
    throw e;
  }
  return { tempPath, cleanup };
}

function extFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const ct = contentType.split(';')[0]?.trim().toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
  };
  return map[ct] ?? null;
}

function extFromUrl(url: string): string | null {
  try {
    const p = new URL(url).pathname;
    const ext = path.extname(p).toLowerCase();
    if (!ext) return null;
    if (IMAGE_EXT.has(ext) || isVideoExt(ext)) return ext;
    return null;
  } catch {
    return null;
  }
}

function isAllowedExt(ext: string): boolean {
  const e = ext.toLowerCase();
  return IMAGE_EXT.has(e) || isVideoExt(e);
}

export async function downloadUrlToTempFile(
  url: string,
  maxBytes = 32 * 1024 * 1024
): Promise<{ tempPath: string; cleanup: () => Promise<void> }> {
  if (isHlsUrl(url)) {
    return downloadHlsToTempFile(url, maxBytes);
  }

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error('File too large');
  }

  const chunks: Buffer[] = [];
  let total = 0;
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error('File too large');
    chunks.push(buf);
    total = buf.length;
  } else {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('File too large');
      chunks.push(Buffer.from(value));
    }
  }

  const ext =
    extFromUrl(url) ??
    extFromContentType(res.headers.get('content-type')) ??
    '.jpg';

  if (!isAllowedExt(ext)) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const tempPath = path.join(os.tmpdir(), `arc-ext-import-${crypto.randomUUID()}${ext}`);
  await writeFile(tempPath, Buffer.concat(chunks));

  const cleanup = async () => {
    try {
      await unlink(tempPath);
    } catch {
      /* ignore */
    }
  };

  return { tempPath, cleanup };
}
