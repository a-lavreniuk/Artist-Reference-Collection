/**
 * Форматирование размера в человекочитаемый вид.
 * Совпадает с прежней реализацией в `SettingsStatisticsPanel` (был дубль).
 *
 * Кейсы:
 *   < 1 КБ          → «N Б»
 *   < 1 МБ          → «N.N КБ»
 *   < 1 ГБ          → «N.N МБ»
 *   ≥ 1 ГБ          → «N.NN ГБ»
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 Б';
  if (n < 1024) return `${Math.round(n)} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

const BYTES_PER_MB = 1024 * 1024;

/**
 * Оценка размера для UI: суммарные байты (или доля в байтах) → целые мегабайты
 * с математическим округлением (`Math.round`).
 */
export function formatBytesRoundedToMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 МБ';
  const mb = bytes / BYTES_PER_MB;
  return `${Math.round(mb)} МБ`;
}

/**
 * Формат для раздела «Статистика» (Figma): целые Мб, суффикс «Мб», пробел в тысячах.
 */
export function formatBytesRoundedMbFigma(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Мб';
  const mb = Math.round(bytes / BYTES_PER_MB);
  const grouped = mb.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} Мб`;
}
