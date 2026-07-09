import { spawn } from 'child_process';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';

import { resolveFfmpegExecutable } from '../ffmpeg';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

function ytdlpBinaryName(): string {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  return 'yt-dlp';
}

function ytdlpDownloadUrl(): string {
  const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
  if (process.platform === 'win32') {
    return `${base}/yt-dlp.exe`;
  }
  if (process.platform === 'darwin') {
    return `${base}/yt-dlp_macos`;
  }
  return `${base}/yt-dlp`;
}

function ytdlpCacheDir(): string {
  return path.join(os.homedir(), '.arc', 'bin');
}

export function resolveYtdlpExecutable(): string {
  const fromEnv = process.env.YTDLP_BIN || process.env.ARC_YTDLP_PATH;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return path.resolve(fromEnv.trim());
  }
  return path.join(ytdlpCacheDir(), ytdlpBinaryName());
}

export function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) return true;
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase()) && !host.endsWith('.youtube.com')) {
      return false;
    }
    const p = parsed.pathname;
    return (
      p.startsWith('/watch') ||
      p.startsWith('/shorts/') ||
      p.startsWith('/embed/') ||
      p.startsWith('/live/')
    );
  } catch {
    return false;
  }
}

async function ensureYtdlpExecutable(): Promise<string> {
  const binPath = resolveYtdlpExecutable();
  try {
    const info = await stat(binPath);
    if (info.isFile() && info.size > 0) return binPath;
  } catch {
    /* download below */
  }

  await mkdir(path.dirname(binPath), { recursive: true });
  const res = await fetch(ytdlpDownloadUrl(), { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }
  if (!res.body) {
    throw new Error('Failed to download yt-dlp: empty response');
  }

  const tmpPath = `${binPath}.download`;
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(tmpPath));
  await stat(tmpPath);

  if (process.platform !== 'win32') {
    const { chmod } = await import('fs/promises');
    await chmod(tmpPath, 0o755);
  }

  const { rename } = await import('fs/promises');
  await rename(tmpPath, binPath);
  return binPath;
}

function runProcess(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = stderr.trim() || stdout.trim();
      reject(new Error(detail || `yt-dlp exited with code ${code}`));
    });
  });
}

export async function downloadYoutubeToTempFile(
  watchUrl: string,
  maxBytes: number
): Promise<{ tempPath: string; cleanup: () => Promise<void> }> {
  if (!isYoutubeUrl(watchUrl)) {
    throw new Error('Not a YouTube URL');
  }

  const ytdlp = await ensureYtdlpExecutable();
  const tempPath = path.join(os.tmpdir(), `arc-ext-import-${crypto.randomUUID()}.mp4`);
  const ffmpeg = resolveFfmpegExecutable();

  const args = [
    watchUrl,
    '-f',
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
    '--merge-output-format',
    'mp4',
    '--ffmpeg-location',
    ffmpeg,
    '--no-playlist',
    '--no-warnings',
    '--max-filesize',
    `${Math.floor(maxBytes / (1024 * 1024))}M`,
    '-o',
    tempPath
  ];

  try {
    await runProcess(ytdlp, args, 15 * 60 * 1000);
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : 'YouTube download failed';
    if (/private|sign in|login|members.only/i.test(message)) {
      throw new Error('Video is private or requires sign-in');
    }
    if (/unavailable|removed|not available|geo|country/i.test(message)) {
      throw new Error('Video is unavailable');
    }
    throw new Error(message);
  }

  const info = await stat(tempPath);
  if (info.size > maxBytes) {
    await unlink(tempPath);
    throw new Error('File too large');
  }

  const cleanup = async () => {
    try {
      await unlink(tempPath);
    } catch {
      /* ignore */
    }
  };

  return { tempPath, cleanup };
}
