import crypto from 'crypto';
import { unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { assembleHlsToMp4, isVideoExt } from '../ffmpeg';
import { MAX_IMPORT_IMAGE_BYTES, MAX_IMPORT_VIDEO_BYTES } from './constants';
import type { ImportMediaKind } from './importMediaKind';
import { resolveImportMaxBytes } from './importMediaKind';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

const HLS_CONTENT_TYPES = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl']);

const DOWNLOAD_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DOWNLOAD_RETRY_ATTEMPTS = 3;

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

function buildDownloadHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DOWNLOAD_USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8'
  };

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === 'pinimg.com' ||
      host.endsWith('.pinimg.com') ||
      host === 'pinterest.com' ||
      host.endsWith('.pinterest.com')
    ) {
      headers.Referer = 'https://www.pinterest.com/';
    }
  } catch {
    /* ignore */
  }

  return headers;
}

function errorCause(err: Error): unknown {
  // TS lib < ES2022 не знает Error.cause; в runtime поле есть.
  return (err as Error & { cause?: unknown }).cause;
}

export function isRetryableDownloadError(err: unknown): boolean {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
    const cause = errorCause(err);
    if (cause instanceof Error) parts.push(cause.message);
    else if (cause != null) parts.push(String(cause));
  } else {
    parts.push(String(err));
  }
  return /fetch failed|timeout|econnreset|econnrefused|enotfound|enetunreach|epipe|socket|und_err|network/i.test(
    parts.join(' ')
  );
}

async function fetchWithRetry(url: string, attempts = DOWNLOAD_RETRY_ATTEMPTS): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, {
        redirect: 'follow',
        headers: buildDownloadHeaders(url)
      });
    } catch (err) {
      lastErr = err;
      if (!isRetryableDownloadError(err) || attempt === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-m4v': '.m4v'
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

function exceedsLimit(total: number, maxBytes: number): boolean {
  return Number.isFinite(maxBytes) && total > maxBytes;
}

export async function downloadUrlToTempFile(
  url: string,
  maxBytes?: number,
  mediaKind?: ImportMediaKind | null
): Promise<{ tempPath: string; cleanup: () => Promise<void> }> {
  const limit = maxBytes ?? resolveImportMaxBytes(url, mediaKind);

  if (isHlsUrl(url)) {
    const hlsLimit = Number.isFinite(limit) ? limit : MAX_IMPORT_VIDEO_BYTES;
    return downloadHlsToTempFile(url, hlsLimit);
  }

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && exceedsLimit(Number(contentLength), limit)) {
    throw new Error('File too large');
  }

  const chunks: Buffer[] = [];
  let total = 0;
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (exceedsLimit(buf.length, limit)) throw new Error('File too large');
    chunks.push(buf);
    total = buf.length;
  } else {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (exceedsLimit(total, limit)) throw new Error('File too large');
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

export { MAX_IMPORT_IMAGE_BYTES, MAX_IMPORT_VIDEO_BYTES };
