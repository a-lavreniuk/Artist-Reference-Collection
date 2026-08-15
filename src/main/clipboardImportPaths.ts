import os from 'os';
import path from 'path';

const TEMP_DIR_NAME = 'arc-clipboard-import';

export function clipboardImportTempDir(): string {
  return path.join(os.tmpdir(), TEMP_DIR_NAME);
}

/** Temp PNG written for Ctrl+V bitmap import — only these paths may be unlinked. */
export function isClipboardImportTempPath(absPath: string): boolean {
  if (typeof absPath !== 'string' || !absPath.trim()) return false;
  const resolved = path.resolve(absPath.trim());
  if (!/\.png$/i.test(resolved)) return false;
  const root = path.resolve(clipboardImportTempDir());
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  if (rel.split(/[\\/]/).some((part) => part === '..')) return false;
  return true;
}
