import path from 'path';

import { isVideoExt } from '../ffmpeg';
import { isYoutubeUrl } from './youtubeDownload';
import { MAX_IMPORT_IMAGE_BYTES, MAX_IMPORT_VIDEO_BYTES } from './constants';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export type ImportMediaKind = 'image' | 'video';

function isHlsPath(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return false;
  }
}

export function isVideoImportUrl(url: string): boolean {
  if (isYoutubeUrl(url)) return true;
  if (isHlsPath(url)) return true;
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return isVideoExt(ext);
  } catch {
    return false;
  }
}

export function isImageImportUrl(url: string): boolean {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return IMAGE_EXT.has(ext);
  } catch {
    return false;
  }
}

export function resolveImportMediaKind(
  url: string,
  explicit?: ImportMediaKind | null
): ImportMediaKind {
  if (explicit === 'video' || explicit === 'image') return explicit;
  return isVideoImportUrl(url) ? 'video' : 'image';
}

export function resolveImportMaxBytes(url: string, mediaKind?: ImportMediaKind | null): number {
  const kind = resolveImportMediaKind(url, mediaKind);
  return kind === 'video' ? MAX_IMPORT_VIDEO_BYTES : MAX_IMPORT_IMAGE_BYTES;
}
