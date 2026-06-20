/** Парсит stored time `YYYY-MM-DD HH:mm:ss` → отображение `DD.MM.YYYY HH:mm`. */
export function formatHistoryDisplayTime(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw.trim());
  if (!m) return raw;
  const [, y, mo, d, h, mi] = m;
  return `${d}.${mo}.${y} ${h}:${mi}`;
}
