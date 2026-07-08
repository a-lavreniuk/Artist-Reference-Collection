import { hexToHsv, hsvToHex } from './colorPicker';

export type ColorFormat = 'hex' | 'rgb' | 'cmyk' | 'hsl' | 'hsb' | 'pantone';

export const COLOR_FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: 'HEX',
  rgb: 'RGB',
  cmyk: 'CMYK',
  hsl: 'HSL',
  hsb: 'HSB',
  pantone: 'Pantone'
};

/** Базовый набор форматов (модалки, колор-пикеры). Pantone — только в поиске по цвету. */
export const COLOR_FORMAT_ORDER: ColorFormat[] = ['hex', 'rgb', 'cmyk', 'hsl', 'hsb'];

/** Набор форматов в баре поиска по цвету: базовые + Pantone. */
export const COLOR_SEARCH_FORMAT_ORDER: ColorFormat[] = [...COLOR_FORMAT_ORDER, 'pantone'];

export type RgbTriplet = { r: number; g: number; b: number };
export type CmykQuad = { c: number; m: number; y: number; k: number };
export type HslTriplet = { h: number; s: number; l: number };
export type HsbTriplet = { h: number; s: number; b: number };

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampHue(n: number): number {
  const rounded = Math.round(n);
  return ((rounded % 360) + 360) % 360;
}

/** Нормализует HEX (#RRGGBB) без потери точности каналов. */
export function normalizeColorHex(value: string): string | null {
  const t = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return null;
  return `#${t.toUpperCase()}`;
}

export function hexToRgb(hex: string): RgbTriplet | null {
  const normalized = normalizeColorHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

export function rgbToHex(r: number, g: number, b: number): string | null {
  const rr = clampByte(r);
  const gg = clampByte(g);
  const bb = clampByte(b);
  const to = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

/** Математический CMYK без ICC — приблизительно, не для печати. */
export function hexToCmyk(hex: string): CmykQuad | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1 - 1e-6) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: clampPercent(c * 100),
    m: clampPercent(m * 100),
    y: clampPercent(y * 100),
    k: clampPercent(k * 100)
  };
}

export function cmykToHex(c: number, m: number, y: number, k: number): string | null {
  const cc = clampPercent(c) / 100;
  const mm = clampPercent(m) / 100;
  const yy = clampPercent(y) / 100;
  const kk = clampPercent(k) / 100;
  const r = 255 * (1 - cc) * (1 - kk);
  const g = 255 * (1 - mm) * (1 - kk);
  const b = 255 * (1 - yy) * (1 - kk);
  return rgbToHex(r, g, b);
}

export function hexToHsl(hex: string): HslTriplet | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l: clampPercent(l * 100) };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: clampHue(h * 360), s: clampPercent(s * 100), l: clampPercent(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string | null {
  const hh = clampHue(h) / 360;
  const ss = clampPercent(s) / 100;
  const ll = clampPercent(l) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return rgbToHex(v, v, v);
  }
  const hueToRgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const r = hueToRgb(p, q, hh + 1 / 3);
  const g = hueToRgb(p, q, hh);
  const b = hueToRgb(p, q, hh - 1 / 3);
  return rgbToHex(r * 255, g * 255, b * 255);
}

/** HSB совпадает с HSV текущего колор-пикера. */
export function hexToHsb(hex: string): HsbTriplet | null {
  const hsv = hexToHsv(hex);
  if (!hsv) return null;
  return { h: hsv.h, s: hsv.s, b: hsv.v };
}

export function hsbToHex(h: number, s: number, b: number): string | null {
  return hsvToHex(clampHue(h), clampPercent(s), clampPercent(b));
}

export function parseRgbChannels(rawR: string, rawG: string, rawB: string): string | null {
  const parseByte = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampByte(n) : null;
  };
  const r = parseByte(rawR);
  const g = parseByte(rawG);
  const b = parseByte(rawB);
  if (r == null || g == null || b == null) return null;
  return rgbToHex(r, g, b);
}

export function parseCmykChannels(rawC: string, rawM: string, rawY: string, rawK: string): string | null {
  const parsePct = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampPercent(n) : null;
  };
  const c = parsePct(rawC);
  const m = parsePct(rawM);
  const y = parsePct(rawY);
  const k = parsePct(rawK);
  if (c == null || m == null || y == null || k == null) return null;
  return cmykToHex(c, m, y, k);
}

export function parseHslChannels(rawH: string, rawS: string, rawL: string): string | null {
  const parseHue = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampHue(n) : null;
  };
  const parsePct = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampPercent(n) : null;
  };
  const h = parseHue(rawH);
  const s = parsePct(rawS);
  const l = parsePct(rawL);
  if (h == null || s == null || l == null) return null;
  return hslToHex(h, s, l);
}

export function parseHsbChannels(rawH: string, rawS: string, rawB: string): string | null {
  const parseHue = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampHue(n) : null;
  };
  const parsePct = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? clampPercent(n) : null;
  };
  const h = parseHue(rawH);
  const s = parsePct(rawS);
  const b = parsePct(rawB);
  if (h == null || s == null || b == null) return null;
  return hsbToHex(h, s, b);
}
