/** Валидация имени дочерней библиотеки (имя папки на диске). */

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
]);

const INVALID_CHARS_RE = /[\\/:*?"<>|]/;
export const LIBRARY_NAME_MAX_LENGTH = 60;

export type LibraryNameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'reserved' | 'too_long' };

export function validateLibraryName(raw: string): LibraryNameValidation {
  const name = raw.trim();
  if (!name) return { ok: false, reason: 'empty' };
  if (name === '.' || name === '..') return { ok: false, reason: 'invalid' };
  if (name.length > LIBRARY_NAME_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  if (INVALID_CHARS_RE.test(name)) return { ok: false, reason: 'invalid' };
  if (/[. ]$/.test(name)) return { ok: false, reason: 'invalid' };
  const stem = name.split('.')[0] ?? name;
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) return { ok: false, reason: 'reserved' };
  return { ok: true, name };
}
