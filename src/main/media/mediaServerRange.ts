export type ParsedByteRange = { start: number; end: number };

/** Парсит заголовок Range для одного диапазона bytes. */
export function parseSingleByteRange(
  rangeHeader: string | undefined,
  fileSize: number
): ParsedByteRange | 'unsatisfiable' | null {
  if (!rangeHeader || fileSize <= 0) return null;
  const trimmed = rangeHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bytes=')) return null;

  const spec = trimmed.slice(6).split(',')[0]?.trim();
  if (!spec) return null;

  const dash = spec.indexOf('-');
  if (dash < 0) return null;

  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);

  if (startStr && endStr) {
    const start = Number(startStr);
    const end = Number(endStr);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
      return 'unsatisfiable';
    }
    return { start, end: Math.min(end, fileSize - 1) };
  }

  if (startStr && !endStr) {
    const start = Number(startStr);
    if (!Number.isFinite(start) || start >= fileSize) return 'unsatisfiable';
    return { start, end: fileSize - 1 };
  }

  if (!startStr && endStr) {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'unsatisfiable';
    const start = Math.max(0, fileSize - suffix);
    return { start, end: fileSize - 1 };
  }

  return null;
}
