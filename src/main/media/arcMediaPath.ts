import path from 'path';
import { isVideoExt } from '../ffmpeg';

/** Пути из индекса БД (cards/…/original.* | cards/…/Meta/thumb_* | legacy thumb_*). */
export const LIBRARY_CARD_MEDIA_REL =
  /^cards\/[^/]+\/(?:original\.[a-z0-9]+|(?:Meta\/)?thumb_[sml]\.[a-z0-9]+)$/i;

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
  stgToken: string | null,
  stagingAbsByToken?: ReadonlyMap<string, { absPath: string; expiresAt: number }>,
  options?: {
    libraryId?: string | null;
    rootsByLibraryId?: ReadonlyMap<string, string>;
  }
): string | null {
  if (stgToken) {
    const trimmed = stgToken.trim();
    if (!trimmed || !stagingAbsByToken) return null;
    const entry = stagingAbsByToken.get(trimmed);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return path.resolve(entry.absPath);
  }
  if (!relEncoded) return null;

  const relativePath = relEncoded.replace(/\\/g, '/');
  const libId = options?.libraryId?.trim() || null;
  const mappedRoot =
    libId && options?.rootsByLibraryId ? options.rootsByLibraryId.get(libId) ?? null : null;
  if (libId && !mappedRoot) return null;
  const root = mappedRoot ?? libraryRoot;
  if (!root) return null;

  const resolved = path.resolve(root, relativePath.replace(/\//g, path.sep));
  if (!isInsideLibrary(root, resolved)) return null;
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
  params: { rel?: string; stg?: string; sect?: string; lib?: string }
): string {
  const base = origin.replace(/\/$/, '');
  const u = new URL(`${base}/`);
  if (params.rel) u.searchParams.set('rel', params.rel);
  if (params.lib) u.searchParams.set('lib', params.lib);
  if (params.stg) u.searchParams.set('stg', params.stg);
  if (params.sect) u.searchParams.set('sect', params.sect);
  return u.href;
}
