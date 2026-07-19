/**
 * Расширенные метаданные медиафайла для «Информация о файле».
 * Источники: sharp (глубина/пространство), exifr (EXIF), ffprobe (видео).
 */

import sharp from 'sharp';
import exifr from 'exifr';
import { probeVideoTechnicalMeta } from '../ffmpeg';
import type { CardMediaMetaV1, CardType } from './types';

export type { CardMediaMetaV1 };

const EXIF_PICK = [
  'Make',
  'Model',
  'LensModel',
  'ISO',
  'PhotographicSensitivity',
  'FNumber',
  'ExposureTime',
  'FocalLength',
  'DateTimeOriginal'
] as const;

function mapSharpDepth(depth: string | undefined): string | undefined {
  if (!depth) return undefined;
  switch (depth) {
    case 'uchar':
    case 'char':
      return '8 бит';
    case 'ushort':
    case 'short':
      return '16 бит';
    case 'uint':
    case 'int':
      return '32 бит';
    case 'float':
      return '32 бит (float)';
    case 'double':
      return '64 бит (float)';
    default:
      return depth;
  }
}

function formatColorSpace(space: string | undefined): string | undefined {
  if (!space) return undefined;
  const s = space.trim();
  if (!s) return undefined;
  if (s.toLowerCase() === 'srgb') return 'sRGB';
  if (s.toLowerCase() === 'rgb') return 'RGB';
  if (s.toLowerCase() === 'cmyk') return 'CMYK';
  if (s.toLowerCase() === 'b-w' || s.toLowerCase() === 'bw') return 'Ч/Б';
  return s;
}

function formatAperture(fNumber: unknown): string | undefined {
  const n = typeof fNumber === 'number' ? fNumber : Number(fNumber);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `f/${text}`;
}

function formatShutterSpeed(exposureTime: unknown): string | undefined {
  const n = typeof exposureTime === 'number' ? exposureTime : Number(exposureTime);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1) {
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} с` : `${rounded.toFixed(1)} с`;
  }
  const denom = Math.round(1 / n);
  if (denom > 0) return `1/${denom}`;
  return `${n} с`;
}

function formatFocalLength(focal: unknown): string | undefined {
  const n = typeof focal === 'number' ? focal : Number(focal);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} мм`;
}

function formatCamera(make: unknown, model: unknown): string | undefined {
  const makeStr = typeof make === 'string' ? make.trim() : '';
  const modelStr = typeof model === 'string' ? model.trim() : '';
  if (!makeStr && !modelStr) return undefined;
  if (makeStr && modelStr) {
    if (modelStr.toLowerCase().startsWith(makeStr.toLowerCase())) return modelStr;
    return `${makeStr} ${modelStr}`;
  }
  return makeStr || modelStr;
}

function parseExifDate(raw: unknown): string | undefined {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function parseIso(raw: Record<string, unknown>): number | undefined {
  const candidates = [raw.ISO, raw.PhotographicSensitivity];
  for (const c of candidates) {
    const n = typeof c === 'number' ? c : Number(c);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

async function extractImageMeta(absPath: string): Promise<Partial<CardMediaMetaV1>> {
  const out: Partial<CardMediaMetaV1> = {};

  try {
    const meta = await sharp(absPath).metadata();
    const depth = mapSharpDepth(meta.depth);
    if (depth) out.colorDepth = depth;
    const space = formatColorSpace(meta.space);
    if (space) out.colorSpace = space;
    if (typeof meta.density === 'number' && Number.isFinite(meta.density) && meta.density > 0) {
      out.densityDpi = Math.round(meta.density);
    }
  } catch {
    /* ignore sharp failures */
  }

  try {
    const exif = (await exifr.parse(absPath, { pick: [...EXIF_PICK] })) as Record<string, unknown> | undefined;
    if (exif) {
      const camera = formatCamera(exif.Make, exif.Model);
      if (camera) out.camera = camera;
      if (typeof exif.LensModel === 'string' && exif.LensModel.trim()) {
        out.lens = exif.LensModel.trim();
      }
      const iso = parseIso(exif);
      if (iso !== undefined) out.iso = iso;
      const aperture = formatAperture(exif.FNumber);
      if (aperture) out.aperture = aperture;
      const shutter = formatShutterSpeed(exif.ExposureTime);
      if (shutter) out.shutterSpeed = shutter;
      const focal = formatFocalLength(exif.FocalLength);
      if (focal) out.focalLength = focal;
      const dateTaken = parseExifDate(exif.DateTimeOriginal);
      if (dateTaken) out.dateTaken = dateTaken;
    }
  } catch {
    /* ignore missing/corrupt EXIF */
  }

  return out;
}

async function extractVideoMeta(absPath: string): Promise<Partial<CardMediaMetaV1>> {
  const tech = await probeVideoTechnicalMeta(absPath);
  if (!tech) return {};
  const out: Partial<CardMediaMetaV1> = {};
  if (tech.codec) out.videoCodec = tech.codec;
  if (typeof tech.frameRate === 'number' && tech.frameRate > 0) out.frameRate = tech.frameRate;
  if (typeof tech.bitrate === 'number' && tech.bitrate > 0) out.bitrate = tech.bitrate;
  return out;
}

/** Извлекает расширенные метаданные с диска (без записи в библиотеку). */
export async function extractMediaFileMeta(
  absPath: string,
  type: CardType
): Promise<CardMediaMetaV1> {
  const probedAt = new Date().toISOString();
  const partial = type === 'image' ? await extractImageMeta(absPath) : await extractVideoMeta(absPath);
  return {
    version: 1,
    probedAt,
    ...partial
  };
}

export function isMediaMetaProbed(meta: CardMediaMetaV1 | undefined | null): boolean {
  return Boolean(meta && meta.version === 1 && typeof meta.probedAt === 'string' && meta.probedAt);
}

/** Для unit-тестов форматтеров. */
export const mediaMetaFormatters = {
  mapSharpDepth,
  formatColorSpace,
  formatAperture,
  formatShutterSpeed,
  formatFocalLength,
  formatCamera
};
