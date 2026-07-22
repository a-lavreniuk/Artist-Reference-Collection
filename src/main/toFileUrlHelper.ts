import { stat } from 'fs/promises';
import path from 'path';
import { buildMediaServerUrl, isInsideLibrary, LIBRARY_CARD_MEDIA_REL } from './media/arcMediaPath';
import { registerMediaStagingToken } from './media/mediaStagingTokens';

export { isInsideLibrary, LIBRARY_CARD_MEDIA_REL } from './media/arcMediaPath';

export function isAllowedLibraryMediaExt(ext: string, isVideoExt: (e: string) => boolean): boolean {
  const e = ext.toLowerCase();
  if (e === '.gif') return true;
  const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
  return IMAGE_EXT.has(e) || isVideoExt(e);
}

function mediaOriginOrFallback(origin: string | null): string {
  return origin ?? 'arc-media://localhost';
}

export async function resolvePathToMediaUrl(
  raw: string,
  libraryRoot: string | null,
  isVideoExt: (e: string) => boolean,
  mediaOrigin: string | null
): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const origin = mediaOriginOrFallback(mediaOrigin);

  const looksAbsolute =
    path.isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\');

  if (looksAbsolute) {
    const abs = path.resolve(trimmed);
    try {
      const st = await stat(abs);
      if (!st.isFile()) return null;
      const ext = path.extname(abs);
      if (!isAllowedLibraryMediaExt(ext, isVideoExt)) return null;
      const token = await registerMediaStagingToken(abs, libraryRoot);
      if (!token) return null;
      return buildMediaServerUrl(origin, { stg: token });
    } catch {
      return null;
    }
  }

  if (!libraryRoot) return null;
  const relStable = trimmed.replace(/\\/g, '/');
  if (LIBRARY_CARD_MEDIA_REL.test(relStable)) {
    return buildMediaServerUrl(origin, { rel: relStable });
  }
  const relNorm = trimmed.replace(/\//g, path.sep);
  const abs = path.resolve(libraryRoot, relNorm);
  if (!isInsideLibrary(libraryRoot, abs)) return null;
  try {
    const st = await stat(abs);
    if (!st.isFile()) return null;
    const ext = path.extname(abs);
    if (!isAllowedLibraryMediaExt(ext, isVideoExt)) return null;
    return buildMediaServerUrl(origin, { rel: relStable });
  } catch {
    return null;
  }
}

export async function resolvePathsToMediaUrls(
  paths: readonly string[],
  libraryRoot: string | null,
  isVideoExt: (e: string) => boolean,
  mediaOrigin: string | null
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  const origin = mediaOriginOrFallback(mediaOrigin);
  const needStat: string[] = [];
  for (const rel of unique) {
    const relStable = rel.replace(/\\/g, '/');
    if (libraryRoot && LIBRARY_CARD_MEDIA_REL.test(relStable)) {
      out[relStable] = buildMediaServerUrl(origin, { rel: relStable });
      continue;
    }
    needStat.push(rel);
  }
  if (needStat.length === 0) return out;
  await Promise.all(
    needStat.map(async (rel) => {
      const url = await resolvePathToMediaUrl(rel, libraryRoot, isVideoExt, mediaOrigin);
      if (url) out[rel.replace(/\\/g, '/')] = url;
    })
  );
  return out;
}

