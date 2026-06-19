import { stat } from 'fs/promises';
import path from 'path';

export function isInsideLibrary(libRoot: string, candidateAbs: string): boolean {
  const root = path.resolve(libRoot);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function isAllowedLibraryMediaExt(ext: string, isVideoExt: (e: string) => boolean): boolean {
  const e = ext.toLowerCase();
  if (e === '.gif') return true;
  const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
  return IMAGE_EXT.has(e) || isVideoExt(e);
}

export async function resolvePathToMediaUrl(
  raw: string,
  libraryRoot: string | null,
  isVideoExt: (e: string) => boolean
): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const looksAbsolute =
    path.isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\');

  if (looksAbsolute) {
    const abs = path.resolve(trimmed);
    try {
      const st = await stat(abs);
      if (!st.isFile()) return null;
      const ext = path.extname(abs);
      if (!isAllowedLibraryMediaExt(ext, isVideoExt)) return null;
      return `arc-media://localhost/?abs=${encodeURIComponent(abs)}`;
    } catch {
      return null;
    }
  }

  if (!libraryRoot) return null;
  const relNorm = trimmed.replace(/\//g, path.sep);
  const abs = path.resolve(libraryRoot, relNorm);
  if (!isInsideLibrary(libraryRoot, abs)) return null;
  try {
    const st = await stat(abs);
    if (!st.isFile()) return null;
    const ext = path.extname(abs);
    if (!isAllowedLibraryMediaExt(ext, isVideoExt)) return null;
    const relStable = trimmed.replace(/\\/g, '/');
    return `arc-media://localhost/?rel=${encodeURIComponent(relStable)}`;
  } catch {
    return null;
  }
}

export async function resolvePathsToMediaUrls(
  paths: readonly string[],
  libraryRoot: string | null,
  isVideoExt: (e: string) => boolean
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (rel) => {
      const url = await resolvePathToMediaUrl(rel, libraryRoot, isVideoExt);
      if (url) out[rel.replace(/\\/g, '/')] = url;
    })
  );
  return out;
}
