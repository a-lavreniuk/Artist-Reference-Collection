import sharp from 'sharp';

export type PaletteSwatch = {
  hex: string;
  pct: number;
};

const PALETTE_SIZE = 72;
const MAX_COLORS = 8;
const MIN_ALPHA = 160;

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** Палитра 5–8 swatches с долями (как cardDetailPalette, но на стороне main). */
export async function computeImagePalette(sourceAbs: string, maxColors = MAX_COLORS): Promise<PaletteSwatch[]> {
  const { data, info } = await sharp(sourceAbs)
    .rotate()
    .resize(PALETTE_SIZE, PALETTE_SIZE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, number>();
  let total = 0;
  const ch = info.channels;

  for (let i = 0; i < data.length; i += ch) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < MIN_ALPHA) continue;
    const r = data[i]! >> 3;
    const g = data[i + 1]! >> 3;
    const b = data[i + 2]! >> 3;
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    total += 1;
  }

  if (total === 0) return [];

  const ranked = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map((x) => Number.parseInt(x, 10) * 8 + 4);
      return { hex: rgbToHex(r, g, b), pct: Math.round((count / total) * 100) };
    });

  const sumPct = ranked.reduce((acc, row) => acc + row.pct, 0);
  if (sumPct > 0 && sumPct !== 100 && ranked[0]) {
    ranked[0] = { ...ranked[0], pct: ranked[0].pct + (100 - sumPct) };
  }

  return ranked;
}

export function parsePaletteJson(raw: string | null | undefined, fallbackDominant?: string): PaletteSwatch[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const swatches = parsed
          .filter(
            (x): x is { hex: string; pct: number } =>
              Boolean(x) &&
              typeof x === 'object' &&
              typeof (x as { hex?: string }).hex === 'string' &&
              typeof (x as { pct?: number }).pct === 'number'
          )
          .map((x) => ({ hex: normalizeHex(x.hex), pct: Math.max(0, x.pct) }))
          .filter((x) => x.hex);
        if (swatches.length > 0) return swatches;
      }
    } catch {
      /* fallback below */
    }
  }
  const dom = fallbackDominant ? normalizeHex(fallbackDominant) : '';
  return dom ? [{ hex: dom, pct: 100 }] : [];
}

export function normalizeHex(input: string): string {
  const t = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return '';
  return `#${t.toUpperCase()}`;
}
