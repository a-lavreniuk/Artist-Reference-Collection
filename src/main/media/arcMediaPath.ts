import path from 'path';
import { isVideoExt } from '../ffmpeg';

/** Пути из индекса БД (cards/…/thumb_* | original.*). */
export const LIBRARY_CARD_MEDIA_REL =
  /^cards\/[^/]+\/(?:thumb_[sml]|original)\.[a-z0-9]+$/i;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export function isInsideLibrary(libRoot: string, candidateAbs: string): boolean {
  const root = path.resolve(libRoot);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function isAllowedMediaExt(ext: string): boolean {
  const e = ext.toLowerCase();
  if (e === '.gif') return true;
  return IMAGE_EXT.has(e) || isVideoExt(e);
}

export function resolveMediaAbsFromParams(
  libraryRoot: string | null,
  relEncoded: string | null,
  absEncoded: string | null
): string | null {
  if (absEncoded) {
    return path.resolve(decodeURIComponent(absEncoded));
  }
  if (!relEncoded || !libraryRoot) return null;

  const relativePath = relEncoded.replace(/\\/g, '/');
  const resolved = path.resolve(libraryRoot, relativePath.replace(/\//g, path.sep));
  if (!isInsideLibrary(libraryRoot, resolved)) return null;
  return resolved;
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
};

export function mimeForMediaExt(ext: string): string {
  return MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

export function buildMediaServerUrl(
  origin: string,
  params: { rel?: string; abs?: string; sect?: string }
): string {
  const base = origin.replace(/\/$/, '');
  const u = new URL(`${base}/`);
  if (params.rel) u.searchParams.set('rel', params.rel);
  if (params.abs) u.searchParams.set('abs', params.abs);
  if (params.sect) u.searchParams.set('sect', params.sect);
  return u.href;
}
