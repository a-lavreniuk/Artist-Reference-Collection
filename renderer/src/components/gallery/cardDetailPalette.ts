export type PaletteSwatch = {
  hex: string;
  pct: number;
};

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export async function extractImagePalette(src: string, maxColors = 8): Promise<PaletteSwatch[]> {
  if (!src) return [];

  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('palette load failed'));
    img.src = src;
  });

  const size = 72;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, number>();
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 160) continue;
    const r = data[i] >> 3;
    const g = data[i + 1] >> 3;
    const b = data[i + 2] >> 3;
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
