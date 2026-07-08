import { readdir, stat } from 'fs/promises';
import path from 'path';
import { isVideoExt } from './ffmpeg';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

export function isImportableMediaAbsPath(absPath: string): boolean {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.gif') return true;
  return isImageExt(ext) || isVideoExt(ext);
}

export async function classifyDroppedPaths(
  absolutePaths: readonly string[]
): Promise<{ files: string[]; directories: string[] }> {
  const files: string[] = [];
  const directories: string[] = [];
  for (const absPath of absolutePaths) {
    if (typeof absPath !== 'string' || !absPath.trim()) continue;
    try {
      const st = await stat(absPath);
      if (st.isDirectory()) directories.push(absPath);
      else if (st.isFile()) files.push(absPath);
    } catch {
      /* unreadable path */
    }
  }
  return { files, directories };
}

/** Только файлы в корне папки; подпапки игнорируются. */
export async function listImportableFilesInDirectoryRoot(folderPath: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) continue;
      const abs = path.join(folderPath, ent.name);
      if (isImportableMediaAbsPath(abs)) out.push(abs);
    }
  } catch {
    /* unreadable folder */
  }
  return out;
}
