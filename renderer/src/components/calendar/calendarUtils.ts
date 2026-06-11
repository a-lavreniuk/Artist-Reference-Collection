export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
] as const;

export type CalendarCell = {
  date: Date;
  inMonth: boolean;
  iso: string;
};

export function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function isBetweenInclusive(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      date,
      inMonth: date.getMonth() === month,
      iso: toIsoLocal(date)
    });
  }
  return cells;
}

export function buildYearOptions(centerYear: number, span = 20): number[] {
  const years: number[] = [];
  for (let y = centerYear - span; y <= centerYear + span; y += 1) {
    years.push(y);
  }
  return years;
}
