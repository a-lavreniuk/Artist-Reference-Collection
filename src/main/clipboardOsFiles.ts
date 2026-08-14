import path from 'path';

/** DROPFILES header is 20 bytes on Windows (DWORD + POINT + 2×BOOL). */
const DROPFILES_SIZE = 20;

export function fileUriToAbsPath(uri: string): string | null {
  const line = uri.trim();
  if (!line || line.startsWith('#')) return null;
  try {
    const url = new URL(line);
    if (url.protocol !== 'file:') return null;
    let p = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return p ? path.normalize(p) : null;
  } catch {
    return null;
  }
}

export function parseClipboardUriList(raw: string): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim().replace(/^["']|["']$/g, '');
    if (!t || t.startsWith('#')) continue;
    const fromUri = fileUriToAbsPath(t);
    if (fromUri) {
      out.push(fromUri);
      continue;
    }
    if (/^[A-Za-z]:[\\/]/.test(t) || t.startsWith('\\\\')) {
      out.push(path.normalize(t));
    }
  }
  return out;
}

export function parseFileNameW(buf: Buffer): string | null {
  if (!buf || buf.length < 2) return null;
  const s = buf.toString('utf16le').replace(/\u0000+$/g, '').trim().replace(/^["']|["']$/g, '');
  return s ? path.normalize(s) : null;
}

function readWideCStrings(buf: Buffer, start: number): string[] {
  const out: string[] = [];
  let offset = start;
  while (offset + 1 < buf.length) {
    if (buf[offset] === 0 && buf[offset + 1] === 0) break;
    let end = offset;
    while (end + 1 < buf.length && !(buf[end] === 0 && buf[end + 1] === 0)) end += 2;
    const s = buf.subarray(offset, end).toString('utf16le').replace(/\u0000/g, '').trim();
    if (s) out.push(path.normalize(s));
    offset = end + 2;
  }
  return out;
}

function readAnsiCStrings(buf: Buffer, start: number): string[] {
  const out: string[] = [];
  let offset = start;
  while (offset < buf.length) {
    if (buf[offset] === 0) break;
    let end = offset;
    while (end < buf.length && buf[end] !== 0) end += 1;
    const s = buf.subarray(offset, end).toString('utf8').trim();
    if (s) out.push(path.normalize(s));
    offset = end + 1;
  }
  return out;
}

/** Parse Windows CF_HDROP (`DROPFILES` + double-null path list). */
export function parseCfHdrop(buf: Buffer): string[] {
  if (!buf || buf.length < 4) return [];
  if (buf.length >= DROPFILES_SIZE) {
    const pFiles = buf.readUInt32LE(0);
    const fWide = buf.readInt32LE(16) !== 0;
    if (pFiles >= DROPFILES_SIZE && pFiles < buf.length) {
      return fWide ? readWideCStrings(buf, pFiles) : readAnsiCStrings(buf, pFiles);
    }
  }
  return readWideCStrings(buf, 0);
}

export function uniqueAbsPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.includes('\0')) continue;
    const resolved = path.resolve(trimmed);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}
