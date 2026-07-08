import pantoneCoated from '../data/pantoneCoated.json';
import { normalizeColorHex } from './colorFormats';

/**
 * Приблизительная открытая таблица Pantone Solid Coated.
 * Значения не для печати: без ICC-профилей и лицензионных данных Pantone.
 */
export const PANTONE_LIBRARY = 'Solid Coated';

export type PantoneEntry = {
  code: string;
  hex: string;
  name: string;
};

type PantoneWithLab = PantoneEntry & { lab: Lab };

type Lab = { L: number; a: number; b: number };

const ENTRIES: PantoneEntry[] = pantoneCoated as PantoneEntry[];

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const rr = srgbToLinear(r);
  const gg = srgbToLinear(g);
  const bb = srgbToLinear(b);
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE76(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function hexToLab(hex: string): Lab | null {
  const normalized = normalizeColorHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return rgbToLab(r, g, b);
}

let entriesWithLab: PantoneWithLab[] | null = null;

function getEntriesWithLab(): PantoneWithLab[] {
  if (entriesWithLab) return entriesWithLab;
  entriesWithLab = ENTRIES.map((entry) => ({
    ...entry,
    lab: hexToLab(entry.hex) ?? { L: 0, a: 0, b: 0 }
  }));
  return entriesWithLab;
}

/** Приводит ключ кода к единому виду для сравнения: нижний регистр, единый разделитель. */
function normalizePantoneKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/pantone|pms/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();
}

const codeIndex = new Map<string, PantoneEntry>();
for (const entry of ENTRIES) {
  codeIndex.set(normalizePantoneKey(entry.code), entry);
}

/** Отображение кода по макету: числовые коды с дефисом (`185 C` → `185-C`). */
export function formatPantoneCode(code: string): string {
  const match = /^(\d+)\s*C$/i.exec(code.trim());
  if (match) return `${match[1]}-C`;
  return code.trim();
}

/** Находит Pantone по введённому коду (`185`, `185 C`, `185-C`, `pantone 185 c`). */
export function findPantoneByCode(raw: string): PantoneEntry | null {
  const key = normalizePantoneKey(raw);
  if (!key) return null;
  const direct = codeIndex.get(key);
  if (direct) return direct;
  const withSuffix = codeIndex.get(`${key} c`);
  if (withSuffix) return withSuffix;
  return null;
}

/** Возвращает HEX для введённого кода Pantone либо null. */
export function pantoneToHex(raw: string): string | null {
  return findPantoneByCode(raw)?.hex ?? null;
}

/** Ближайшие записи Pantone к цвету по ΔE76 в Lab. */
export function findNearestPantones(hex: string, count: number): PantoneEntry[] {
  const targetLab = hexToLab(hex);
  if (!targetLab) return [];
  const scored = getEntriesWithLab()
    .map((entry) => ({ entry, distance: deltaE76(targetLab, entry.lab) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(0, count));
  return scored.map((item) => item.entry);
}
