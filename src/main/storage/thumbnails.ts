import sharp from 'sharp';
import type { ImageDupFingerprint } from './types';
import { THUMB_L_MAX, THUMB_M_MAX, THUMB_S_MAX } from './types';

const SAMPLE = 32;
const HASH = 8;
const HIST_BINS = 32;

function gray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function averageHashFromGray8x8(vals: number[]): string {
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.map((v) => (v > avg ? '1' : '0')).join('');
}

function luminanceHistogram(data: Buffer, channels: number): number[] {
  const h = new Array<number>(HIST_BINS).fill(0);
  for (let i = 0; i < data.length; i += channels) {
    const y = gray(data[i]!, data[i + 1]!, data[i + 2]!);
    const idx = Math.min(HIST_BINS - 1, Math.floor((y / 256) * HIST_BINS));
    h[idx] += 1;
  }
  const sum = h.reduce((a, b) => a + b, 0) || 1;
  return h.map((x) => x / sum);
}

async function hashFromRotatedBuffer(input: Buffer, rotate: number): Promise<{ hash: string; hist?: number[] }> {
  let pipeline = sharp(input).rotate(rotate).resize(SAMPLE, SAMPLE, { fit: 'inside' });
  const sampled = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const small = await sharp(sampled.data, {
    raw: { width: sampled.info.width, height: sampled.info.height, channels: sampled.info.channels }
  })
    .resize(HASH, HASH, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const vals: number[] = [];
  const ch = small.info.channels;
  for (let i = 0; i < small.data.length; i += ch) {
    vals.push(gray(small.data[i]!, small.data[i + 1]!, small.data[i + 2]!));
  }
  const hash = averageHashFromGray8x8(vals);
  const hist = rotate === 0 ? luminanceHistogram(sampled.data, sampled.info.channels) : undefined;
  return { hash, hist };
}

export async function computeImagePhash(inputAbs: string): Promise<ImageDupFingerprint | null> {
  try {
    const input = await readFileBuffer(inputAbs);
    const rots = [0, 90, 180, 270] as const;
    const rotHashes: [string, string, string, string] = ['', '', '', ''];
    let hist: number[] | null = null;
    for (let i = 0; i < rots.length; i++) {
      const { hash, hist: h } = await hashFromRotatedBuffer(input, rots[i]!);
      rotHashes[i] = hash;
      if (h) hist = h;
    }
    if (!hist) return null;
    return { rotHashes, hist };
  } catch {
    return null;
  }
}

async function readFileBuffer(abs: string): Promise<Buffer> {
  const fs = await import('fs/promises');
  return fs.readFile(abs);
}

function dominantFromStats(stats: sharp.Stats): string {
  const d = stats.dominant;
  if (!d) return '#2a2a2a';
  const r = Math.round(d.r);
  const g = Math.round(d.g);
  const b = Math.round(d.b);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function writeThumbWebp(input: Buffer | string, outputAbs: string, maxSide: number): Promise<void> {
  await sharp(input)
    .rotate()
    .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outputAbs);
}

export type ThumbnailResult = {
  dominantColorHex: string;
  width: number;
  height: number;
  phash?: ImageDupFingerprint;
};

export async function generateImageThumbnails(
  sourceAbs: string,
  thumbSAbs: string,
  thumbMAbs: string,
  thumbLAbs: string,
  computePhash: boolean
): Promise<ThumbnailResult> {
  const meta = await sharp(sourceAbs).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const stats = await sharp(sourceAbs).rotate().stats();
  const dominantColorHex = dominantFromStats(stats);

  const inputBuf = await readFileBuffer(sourceAbs);
  await Promise.all([
    writeThumbWebp(inputBuf, thumbSAbs, THUMB_S_MAX),
    writeThumbWebp(inputBuf, thumbMAbs, THUMB_M_MAX),
    writeThumbWebp(inputBuf, thumbLAbs, THUMB_L_MAX)
  ]);

  const phash = computePhash ? await computeImagePhash(sourceAbs) : undefined;
  return { dominantColorHex, width, height, ...(phash ? { phash } : {}) };
}

export async function generateVideoThumbnailsFromFrame(
  frameJpegAbs: string,
  thumbSAbs: string,
  thumbMAbs: string,
  thumbLAbs: string
): Promise<ThumbnailResult> {
  const meta = await sharp(frameJpegAbs).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const stats = await sharp(frameJpegAbs).stats();
  const dominantColorHex = dominantFromStats(stats);
  const inputBuf = await readFileBuffer(frameJpegAbs);
  await Promise.all([
    writeThumbWebp(inputBuf, thumbSAbs, THUMB_S_MAX),
    writeThumbWebp(inputBuf, thumbMAbs, THUMB_M_MAX),
    writeThumbWebp(inputBuf, thumbLAbs, THUMB_L_MAX)
  ]);
  return { dominantColorHex, width, height };
}
