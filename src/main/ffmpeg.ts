import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { rename, unlink } from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile) as (
  file: string,
  args: readonly string[],
  options: { windowsHide?: boolean; timeout?: number; maxBuffer?: number }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

/** Расширения видео, допустимые при импорте (совпадают с whitelist в renderer). */
export const VIDEO_EXT = new Set([
  '.gif',
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.flv',
  '.wmv',
  '.mpeg',
  '.mpg',
  '.m2v',
  '.3gp',
  '.ts',
  '.mts',
  '.m4v',
  '.ogv',
  '.vob',
  '.rmvb',
  '.swf'
]);

export function isVideoExt(ext: string): boolean {
  return VIDEO_EXT.has(ext.toLowerCase());
}

export function resolveFfmpegExecutable(): string {
  const fromEnv = process.env.FFMPEG_BIN || process.env.ARC_FFMPEG_PATH;
  if (typeof fromEnv === 'string' && fromEnv.trim() && fs.existsSync(fromEnv.trim())) {
    return path.resolve(fromEnv.trim());
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('ffmpeg-static') as string | null;
    if (p && fs.existsSync(p)) return p;
  } catch {
    /* optional dependency resolution */
  }
  return 'ffmpeg';
}

export function resolveFfprobeExecutable(): string {
  const fromEnv = process.env.FFPROBE_BIN || process.env.ARC_FFPROBE_PATH;
  if (typeof fromEnv === 'string' && fromEnv.trim() && fs.existsSync(fromEnv.trim())) {
    return path.resolve(fromEnv.trim());
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ffprobe-static') as { path: string };
    if (mod?.path && fs.existsSync(mod.path)) return mod.path;
  } catch {
    /* optional */
  }
  return 'ffprobe';
}

function runProcess(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Таймаут ${timeoutMs} мс`));
    }, timeoutMs);
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ code, stderr });
    });
  });
}

const FRAME_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 30_000;
const HLS_TIMEOUT_MS = 180_000;

/**
 * Скачивает HLS-поток (.m3u8) и собирает его в локальный MP4 без перекодирования.
 * Рассчитан на потоки Pinterest (MPEG-TS + AAC): используется ремукс `-c copy`
 * и битстрим-фильтр `aac_adtstoasc` для корректной упаковки звука в MP4.
 * @param maxBytes ограничение размера выходного файла (ffmpeg `-fs`); 0/undefined — без лимита.
 */
export async function assembleHlsToMp4(
  hlsUrl: string,
  outputMp4Abs: string,
  maxBytes?: number
): Promise<void> {
  const ffmpeg = resolveFfmpegExecutable();
  const tmpOut = `${outputMp4Abs}.${process.pid}.tmp.mp4`;
  try {
    if (fs.existsSync(tmpOut)) await unlink(tmpOut);
  } catch {
    /* ignore */
  }

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-protocol_whitelist',
    'http,https,tcp,tls,crypto',
    '-i',
    hlsUrl,
    '-c',
    'copy',
    '-bsf:a',
    'aac_adtstoasc'
  ];
  if (typeof maxBytes === 'number' && maxBytes > 0) {
    args.push('-fs', String(maxBytes));
  }
  args.push(tmpOut);

  try {
    const { code, stderr } = await runProcess(ffmpeg, args, HLS_TIMEOUT_MS);
    if (code !== 0) {
      throw new Error(stderr.trim() || `ffmpeg завершился с кодом ${code}`);
    }
    if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size === 0) {
      throw new Error('ffmpeg не создал видеофайл из HLS');
    }
    await rename(tmpOut, outputMp4Abs);
  } catch (e) {
    try {
      if (fs.existsSync(tmpOut)) await unlink(tmpOut);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export type ExtractVideoFrameOptions = {
  /** Позиция кадра в миллисекундах; 0 или не задано — первый кадр. */
  atMs?: number;
};

function buildFfmpegSeekArgs(atMs?: number): string[] {
  if (atMs == null || !Number.isFinite(atMs) || atMs <= 0) return [];
  const sec = Math.max(0, atMs) / 1000;
  return ['-ss', sec.toFixed(3)];
}

export const __testOnly = { buildFfmpegSeekArgs };

/**
 * Кадр видео -> JPEG (для превью карточки).
 */
export async function extractVideoFrameToJpeg(
  inputAbs: string,
  outputJpegAbs: string,
  options?: ExtractVideoFrameOptions
): Promise<void> {
  const ffmpeg = resolveFfmpegExecutable();
  const tmpOut = `${outputJpegAbs}.${process.pid}.tmp.jpg`;
  try {
    if (fs.existsSync(tmpOut)) await unlink(tmpOut);
  } catch {
    /* ignore */
  }

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...buildFfmpegSeekArgs(options?.atMs),
    '-i',
    inputAbs,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    tmpOut
  ];

  try {
    const { code, stderr } = await runProcess(ffmpeg, args, FRAME_TIMEOUT_MS);
    if (code !== 0) {
      throw new Error(stderr.trim() || `ffmpeg завершился с кодом ${code}`);
    }
    if (!fs.existsSync(tmpOut)) {
      throw new Error('ffmpeg не создал файл превью');
    }
    await rename(tmpOut, outputJpegAbs);
  } catch (e) {
    try {
      if (fs.existsSync(tmpOut)) await unlink(tmpOut);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Кадр видео -> PNG (для сохранения рядом с оригиналом).
 */
export async function extractVideoFrameToPng(
  inputAbs: string,
  outputPngAbs: string,
  options?: ExtractVideoFrameOptions
): Promise<void> {
  const ffmpeg = resolveFfmpegExecutable();
  const tmpOut = `${outputPngAbs}.${process.pid}.tmp.png`;
  try {
    if (fs.existsSync(tmpOut)) await unlink(tmpOut);
  } catch {
    /* ignore */
  }

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...buildFfmpegSeekArgs(options?.atMs),
    '-i',
    inputAbs,
    '-frames:v',
    '1',
    tmpOut
  ];

  try {
    const { code, stderr } = await runProcess(ffmpeg, args, FRAME_TIMEOUT_MS);
    if (code !== 0) {
      throw new Error(stderr.trim() || `ffmpeg завершился с кодом ${code}`);
    }
    if (!fs.existsSync(tmpOut)) {
      throw new Error('ffmpeg не создал файл кадра');
    }
    await rename(tmpOut, outputPngAbs);
  } catch (e) {
    try {
      if (fs.existsSync(tmpOut)) await unlink(tmpOut);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function probeVideoDurationMs(inputAbs: string): Promise<number | null> {
  const ffprobe = resolveFfprobeExecutable();
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputAbs
  ];
  try {
    const { stdout } = await execFileAsync(ffprobe, args, {
      windowsHide: true,
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    });
    const sec = parseFloat(String(stdout).trim());
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.round(sec * 1000);
  } catch {
    return null;
  }
}

export async function probeVideoDimensions(
  inputAbs: string
): Promise<{ width: number; height: number } | null> {
  const tech = await probeVideoTechnicalMeta(inputAbs);
  if (!tech?.width || !tech?.height) return null;
  return { width: tech.width, height: tech.height };
}

function parseFrameRate(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw * 1000) / 1000;
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s || s === '0/0') return undefined;
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const num = Number(a);
    const den = Number(b);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return undefined;
    const fps = num / den;
    if (!Number.isFinite(fps) || fps <= 0) return undefined;
    return Math.round(fps * 1000) / 1000;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 1000) / 1000;
}

export type VideoTechnicalMeta = {
  width?: number;
  height?: number;
  codec?: string;
  frameRate?: number;
  bitrate?: number;
};

/** Ширина/высота + кодек / fps / битрейт через ffprobe JSON. */
export async function probeVideoTechnicalMeta(inputAbs: string): Promise<VideoTechnicalMeta | null> {
  const ffprobe = resolveFfprobeExecutable();
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,codec_name,avg_frame_rate,r_frame_rate:format=bit_rate',
    '-of',
    'json',
    inputAbs
  ];
  try {
    const { stdout } = await execFileAsync(ffprobe, args, {
      windowsHide: true,
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024
    });
    const j = JSON.parse(String(stdout)) as {
      streams?: Array<{
        width?: number;
        height?: number;
        codec_name?: string;
        avg_frame_rate?: string;
        r_frame_rate?: string;
      }>;
      format?: { bit_rate?: string | number };
    };
    const s = j.streams?.[0];
    if (!s) return null;
    const out: VideoTechnicalMeta = {};
    if (
      typeof s.width === 'number' &&
      typeof s.height === 'number' &&
      Number.isFinite(s.width) &&
      Number.isFinite(s.height)
    ) {
      out.width = Math.round(s.width);
      out.height = Math.round(s.height);
    }
    if (typeof s.codec_name === 'string' && s.codec_name.trim()) {
      out.codec = s.codec_name.trim().toUpperCase();
    }
    const fps = parseFrameRate(s.avg_frame_rate) ?? parseFrameRate(s.r_frame_rate);
    if (fps !== undefined) out.frameRate = fps;
    const brRaw = j.format?.bit_rate;
    const br = typeof brRaw === 'number' ? brRaw : Number(brRaw);
    if (Number.isFinite(br) && br > 0) out.bitrate = Math.round(br);
    return out.width || out.height || out.codec || out.frameRate || out.bitrate ? out : null;
  } catch {
    return null;
  }
}
