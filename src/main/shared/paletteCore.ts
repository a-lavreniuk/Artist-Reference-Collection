export type PaletteSwatch = {
  hex: string;
  pct: number;
};

export type PaletteMode = 'display' | 'search';

type Rgb = { r: number; g: number; b: number };

type Lab = { L: number; a: number; b: number };

type Cluster = {
  r: number;
  g: number;
  b: number;
  count: number;
};

const MIN_ALPHA = 160;
const LOW_CHROMA_LAB = 12;

export const PALETTE_MODE_CONFIG = {
  display: {
    maxColors: 6,
    mergeDeltaE: 22,
    minPct: 5,
    achromaticRatio: 0.85
  },
  search: {
    maxColors: 20,
    mergeDeltaE: 12,
    minPct: 1,
    achromaticRatio: 0.95
  }
} as const;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function normalizeHex(input: string): string {
  const t = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return '';
  return `#${t.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16)
  };
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const fx = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function labChroma(lab: Lab): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

function clusterLab(cluster: Cluster): Lab {
  return rgbToLab(cluster.r, cluster.g, cluster.b);
}

function mergeClusters(a: Cluster, other: Cluster): Cluster {
  const count = a.count + other.count;
  return {
    r: (a.r * a.count + other.r * other.count) / count,
    g: (a.g * a.count + other.g * other.count) / count,
    b: (a.b * a.count + other.b * other.count) / count,
    count
  };
}

function normalizePercentages(swatches: PaletteSwatch[]): PaletteSwatch[] {
  if (swatches.length === 0) return [];
  const sumPct = swatches.reduce((acc, row) => acc + row.pct, 0);
  if (sumPct <= 0) return swatches;
  if (sumPct === 100) return swatches;
  const next = swatches.map((row) => ({ ...row, pct: Math.round((row.pct / sumPct) * 100) }));
  const roundedSum = next.reduce((acc, row) => acc + row.pct, 0);
  if (roundedSum !== 100 && next[0]) {
    next[0] = { ...next[0], pct: next[0].pct + (100 - roundedSum) };
  }
  return next;
}

function clustersToSwatches(clusters: Cluster[], total: number): PaletteSwatch[] {
  return clusters.map((cluster) => ({
    hex: rgbToHex(cluster.r, cluster.g, cluster.b),
    pct: Math.round((cluster.count / total) * 100)
  }));
}

function collectPixelsFromRgba(data: Uint8Array | Uint8ClampedArray, channels = 4): Rgb[] {
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels >= 4 ? data[i + 3]! : 255;
    if (alpha < MIN_ALPHA) continue;
    pixels.push({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
  }
  return pixels;
}

function bucketPixels(pixels: Rgb[]): Cluster[] {
  const buckets = new Map<string, Cluster>();
  for (const pixel of pixels) {
    const r = pixel.r >> 2;
    const g = pixel.g >> 2;
    const b = pixel.b >> 2;
    const key = `${r},${g},${b}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += pixel.r;
      existing.g += pixel.g;
      existing.b += pixel.b;
      existing.count += 1;
    } else {
      buckets.set(key, { r: pixel.r, g: pixel.g, b: pixel.b, count: 1 });
    }
  }

  return [...buckets.values()].map((cluster) => ({
    r: cluster.r / cluster.count,
    g: cluster.g / cluster.count,
    b: cluster.b / cluster.count,
    count: cluster.count
  }));
}

function mergeClustersByDeltaE(clusters: Cluster[], mergeDeltaE: number, maxInitial = 64): Cluster[] {
  let working = [...clusters].sort((a, b) => b.count - a.count).slice(0, maxInitial);
  if (working.length === 0) return [];

  let merged = true;
  while (merged && working.length > 1) {
    merged = false;
    let bestI = -1;
    let bestJ = -1;
    let bestD = Number.POSITIVE_INFINITY;

    for (let i = 0; i < working.length; i += 1) {
      const labI = clusterLab(working[i]!);
      for (let j = i + 1; j < working.length; j += 1) {
        const d = deltaE76(labI, clusterLab(working[j]!));
        if (d < bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI >= 0 && bestJ >= 0 && bestD <= mergeDeltaE) {
      const combined = mergeClusters(working[bestI]!, working[bestJ]!);
      working = working.filter((_, idx) => idx !== bestI && idx !== bestJ);
      working.push(combined);
      merged = true;
    }
  }

  return working.sort((a, b) => b.count - a.count);
}

function buildGrayscalePalette(pixels: Rgb[], mode: PaletteMode, total: number): PaletteSwatch[] {
  const config = PALETTE_MODE_CONFIG[mode];
  const lights = pixels.map((pixel) => rgbToLab(pixel.r, pixel.g, pixel.b).L);
  const minL = Math.min(...lights);
  const maxL = Math.max(...lights);
  const spread = maxL - minL;

  const maxGraySwatches = mode === 'display' ? 2 : 3;
  if (spread < 12) {
    const avg = pixels.reduce(
      (acc, pixel) => ({ r: acc.r + pixel.r, g: acc.g + pixel.g, b: acc.b + pixel.b }),
      { r: 0, g: 0, b: 0 }
    );
    const n = pixels.length;
    return [{ hex: rgbToHex(avg.r / n, avg.g / n, avg.b / n), pct: 100 }];
  }

  const targetK = spread > 40 && maxGraySwatches >= 3 ? 3 : Math.min(2, maxGraySwatches);
  const centroids = Array.from({ length: targetK }, (_, idx) => minL + ((idx + 0.5) / targetK) * spread);
  const groups = Array.from({ length: targetK }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

  for (const pixel of pixels) {
    const L = rgbToLab(pixel.r, pixel.g, pixel.b).L;
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < centroids.length; i += 1) {
      const dist = Math.abs(L - centroids[i]!);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const group = groups[bestIdx]!;
    group.r += pixel.r;
    group.g += pixel.g;
    group.b += pixel.b;
    group.count += 1;
  }

  const clusters = groups
    .filter((group) => group.count > 0)
    .map((group) => ({
      r: group.r / group.count,
      g: group.g / group.count,
      b: group.b / group.count,
      count: group.count
    }));

  return normalizePercentages(clustersToSwatches(clusters, total));
}

function isAchromatic(pixels: Rgb[], ratioThreshold: number): boolean {
  if (pixels.length === 0) return false;
  let lowChroma = 0;
  for (const pixel of pixels) {
    if (labChroma(rgbToLab(pixel.r, pixel.g, pixel.b)) < LOW_CHROMA_LAB) lowChroma += 1;
  }
  return lowChroma / pixels.length >= ratioThreshold;
}

export function buildPaletteFromPixels(pixels: Rgb[], mode: PaletteMode = 'search'): PaletteSwatch[] {
  if (pixels.length === 0) return [];

  const config = PALETTE_MODE_CONFIG[mode];
  const total = pixels.length;

  if (isAchromatic(pixels, config.achromaticRatio)) {
    return buildGrayscalePalette(pixels, mode, total);
  }

  const initial = bucketPixels(pixels);
  const merged = mergeClustersByDeltaE(initial, config.mergeDeltaE, mode === 'search' ? 96 : 48);
  const minCount = Math.ceil((config.minPct / 100) * total);

  let selected = merged.filter((cluster) => cluster.count >= minCount).slice(0, config.maxColors);
  if (selected.length === 0) {
    selected = merged.slice(0, config.maxColors);
  }
  if (selected.length === 0) return [];

  return normalizePercentages(clustersToSwatches(selected, total));
}

export function buildPaletteFromRgba(
  data: Uint8Array | Uint8ClampedArray,
  mode: PaletteMode = 'search',
  channels = 4
): PaletteSwatch[] {
  return buildPaletteFromPixels(collectPixelsFromRgba(data, channels), mode);
}

export function buildPaletteFromRaw(
  data: Buffer | Uint8Array,
  width: number,
  height: number,
  channels: number,
  mode: PaletteMode = 'search'
): PaletteSwatch[] {
  const pixels: Rgb[] = [];
  const bytes = data instanceof Buffer ? data : Buffer.from(data);
  const stride = width * height * channels;

  for (let i = 0; i < stride; i += channels) {
    const alpha = channels >= 4 ? bytes[i + 3]! : 255;
    if (alpha < MIN_ALPHA) continue;
    pixels.push({ r: bytes[i]!, g: bytes[i + 1]!, b: bytes[i + 2]! });
  }

  return buildPaletteFromPixels(pixels, mode);
}

/** Лучшее ΔE между запросом и палитрой (для color search). */
export function scorePaletteMinDeltaE(queryHex: string, palette: PaletteSwatch[]): number | null {
  if (palette.length === 0) return null;
  const qRgb = hexToRgb(queryHex);
  const queryLab = rgbToLab(qRgb.r, qRgb.g, qRgb.b);
  let minD = Number.POSITIVE_INFINITY;
  for (const sw of palette) {
    const { r, g, b } = hexToRgb(sw.hex);
    minD = Math.min(minD, deltaE76(queryLab, rgbToLab(r, g, b)));
  }
  return Number.isFinite(minD) ? minD : null;
}
