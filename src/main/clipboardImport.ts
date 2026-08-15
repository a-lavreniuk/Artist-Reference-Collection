import { clipboard } from 'electron';
import { existsSync, statSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

import { clipboardImportTempDir, isClipboardImportTempPath } from './clipboardImportPaths';
import {
  parseCfHdrop,
  parseClipboardUriList,
  parseFileNameW,
  uniqueAbsPaths
} from './clipboardOsFiles';

export { clipboardImportTempDir, isClipboardImportTempPath };

function tryReadBuffer(format: string): Buffer | null {
  try {
    const buf = clipboard.readBuffer(format);
    if (!buf || buf.length === 0) return null;
    return buf;
  } catch {
    return null;
  }
}

function tryReadText(format: string): string {
  try {
    const raw = clipboard.read(format);
    return typeof raw === 'string' ? raw : '';
  } catch {
    return '';
  }
}

function existingFiles(paths: string[]): string[] {
  const out: string[] = [];
  for (const abs of uniqueAbsPaths(paths)) {
    try {
      if (!existsSync(abs)) continue;
      if (!statSync(abs).isFile()) continue;
      out.push(abs);
    } catch {
      /* ignore unreadable paths */
    }
  }
  return out;
}

/**
 * File paths copied in Explorer / Finder / file manager.
 * Chromium paste DataTransfer usually does not expose these — only drag-and-drop does.
 */
export function readClipboardOsFilePaths(): string[] {
  const collected: string[] = [];
  const formats = (() => {
    try {
      return clipboard.availableFormats().map((f) => String(f));
    } catch {
      return [] as string[];
    }
  })();
  const hasFormat = (name: string) =>
    formats.some((f) => f.toLowerCase() === name.toLowerCase());

  if (process.platform === 'win32') {
    const hdrop = tryReadBuffer('CF_HDROP');
    if (hdrop) collected.push(...parseCfHdrop(hdrop));
    if (collected.length === 0) {
      const nameW = tryReadBuffer('FileNameW');
      if (nameW) {
        const one = parseFileNameW(nameW);
        if (one) collected.push(one);
      }
    }
  }

  if (collected.length === 0) {
    for (const format of ['text/uri-list', 'public.file-url']) {
      if (formats.length > 0 && !hasFormat(format)) continue;
      const raw = tryReadText(format);
      if (raw.trim()) collected.push(...parseClipboardUriList(raw));
      if (collected.length > 0) break;
    }
  }

  return existingFiles(collected);
}

export async function writeClipboardImageTemp(): Promise<{ ok: true; path: string } | { ok: false }> {
  const image = clipboard.readImage();
  if (image.isEmpty()) return { ok: false };
  const png = image.toPNG();
  if (!png.length) return { ok: false };
  const dir = clipboardImportTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `arc-paste-${randomUUID()}.png`);
  await writeFile(filePath, png);
  return { ok: true, path: filePath };
}

export async function deleteClipboardImportTemp(absPath: string): Promise<{ ok: true } | { ok: false }> {
  if (!isClipboardImportTempPath(absPath)) return { ok: false };
  const resolved = path.resolve(absPath.trim());
  try {
    await unlink(resolved);
    return { ok: true };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ENOENT') return { ok: true };
    return { ok: false };
  }
}
