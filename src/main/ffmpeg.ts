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
    'file,http,https,tcp,tls,crypto',
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

/**
 * Первый кадр -> JPEG (для превью карточки).
 */
export async function extractVideoFrameToJpeg(
  inputAbs: string,
  outputJpegAbs: string
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
  const ffprobe = resolveFfprobeExecutable();
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
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
      streams?: Array<{ width?: number; height?: number }>;
    };
    const s = j.streams?.[0];
    if (
      s &&
      typeof s.width === 'number' &&
      typeof s.height === 'number' &&
      Number.isFinite(s.width) &&
      Number.isFinite(s.height)
    ) {
      return { width: Math.round(s.width), height: Math.round(s.height) };
    }
  } catch {
    return null;
  }
  return null;
}
