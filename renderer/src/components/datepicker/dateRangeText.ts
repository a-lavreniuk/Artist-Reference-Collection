export type DatepickerMode = 'single' | 'range' | 'optional_range';

export type DateRangeValue = {
  from: string;
  to: string;
};

const RANGE_SEP = /\s*[—–-]\s*/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDdMmYyyy(text: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}.${m}.${y}`;
}

export function getDatepickerPlaceholder(mode: DatepickerMode): string {
  switch (mode) {
    case 'single':
      return 'ДД.ММ.ГГГГ';
    case 'range':
    case 'optional_range':
    default:
      return 'ДД.ММ.ГГГГ — ДД.ММ.ГГГГ';
  }
}

export function formatDateRangeDisplay(
  value: { from: string; to?: string } | null | undefined,
  mode: DatepickerMode
): string {
  if (!value?.from) return '';
  const from = formatDdMmYyyy(value.from);
  if (mode === 'single') return from;
  const toIso = value.to ?? value.from;
  if (toIso === value.from) return from;
  return `${from} — ${formatDdMmYyyy(toIso)}`;
}

export function parseDateRangeText(
  input: string,
  mode: DatepickerMode
): DateRangeValue | null | 'empty' {
  const trimmed = input.trim();
  if (!trimmed) return 'empty';

  const parts = trimmed.split(RANGE_SEP).filter((p) => p.length > 0);

  if (mode === 'single') {
    const from = parseDdMmYyyy(trimmed);
    return from ? { from, to: from } : null;
  }

  if (parts.length === 1) {
    const from = parseDdMmYyyy(parts[0]);
    if (!from) return null;
    if (mode === 'range') return null;
    return { from, to: from };
  }

  if (parts.length === 2) {
    const from = parseDdMmYyyy(parts[0]);
    const to = parseDdMmYyyy(parts[1]);
    if (!from || !to) return null;
    if (from > to) return { from: to, to: from };
    return { from, to };
  }

  return null;
}
