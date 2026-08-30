import { createWriteStream } from 'fs';
import { mkdir, rm, stat } from 'fs/promises';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import type { ModelCatalogEntry, ModelFileSpec } from './types';
import { llamaModelsDir } from './modelManager';
import { assertEnoughDiskSpace } from '../storage/diskSpace';

export type DownloadProgressInfo = {
  percent: number;
  bytesReceived?: number;
  bytesTotal?: number;
};

function hfResolveUrl(hfId: string, filename: string, hfRevision?: string): string {
  const revision = hfRevision?.trim() || 'main';
  return `https://huggingface.co/${hfId}/resolve/${revision}/${encodeURIComponent(filename)}`;
}

function catalogDestDir(userDataPath: string, _entry: ModelCatalogEntry): string {
  return llamaModelsDir(userDataPath);
}

let activeAbort: AbortController | null = null;
let downloadPaused = false;
let pauseWaiters: Array<() => void> = [];

export function pauseGgufDownload(): void {
  downloadPaused = true;
}

export function resumeGgufDownload(): void {
  downloadPaused = false;
  for (const wake of pauseWaiters) wake();
  pauseWaiters = [];
}

export function cancelGgufDownload(): void {
  downloadPaused = false;
  for (const wake of pauseWaiters) wake();
  pauseWaiters = [];
  activeAbort?.abort();
  activeAbort = null;
}

export function isDownloadAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'AbortError' || name === 'TimeoutError') return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /aborted|abort|отменен|отменён|cancel/i.test(message);
}

async function waitWhilePaused(): Promise<void> {
  while (downloadPaused) {
    await new Promise<void>((resolve) => {
      pauseWaiters.push(resolve);
    });
  }
}

/** Один файл без offset/weight: localRatio 0–1 → percent 0–100. */
export const HF_FILE_PROGRESS_SCALE = 100;

export function scaledDownloadPercent(
  localRatio: number,
  progressOffset = 0,
  progressWeight = HF_FILE_PROGRESS_SCALE
): number {
  const ratio = Math.max(0, Math.min(1, localRatio));
  const combined = progressOffset + ratio * progressWeight;
  return Math.max(0, Math.min(100, Math.round(combined)));
}

function reportCombinedProgress(
  onProgress: ((info: DownloadProgressInfo) => void) | undefined,
  progressOffset: number,
  progressWeight: number,
  localRatio: number,
  bytesReceived: number,
  bytesTotal: number,
  capBelowComplete: boolean
): void {
  if (!onProgress) return;
  const ratio = Math.max(0, Math.min(1, localRatio));
  const combined = progressOffset + ratio * progressWeight;
  const capped = capBelowComplete ? Math.min(combined, progressOffset + progressWeight * 0.995) : combined;
  onProgress({
    percent: Math.max(0, Math.min(100, Math.round(capped))),
    bytesReceived,
    bytesTotal: bytesTotal > 0 ? bytesTotal : undefined
  });
}

/** Прогресс одного GGUF-файла (0–100) в общую шкалу модели из нескольких файлов. */
export function ggufOverallPercent(fileIndex: number, fileCount: number, filePercent: number): number {
  if (fileCount <= 0) return 0;
  const weight = 100 / fileCount;
  const local = Math.max(0, Math.min(100, filePercent));
  return Math.max(0, Math.min(100, Math.round(fileIndex * weight + (local / 100) * weight)));
}

export async function downloadHfFile(
  destDir: string,
  hfId: string,
  filename: string,
  hfRevision: string | undefined,
  onProgress?: (info: DownloadProgressInfo) => void,
  progressOffset = 0,
  progressWeight = HF_FILE_PROGRESS_SCALE
): Promise<string> {
  await mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);
  const url = hfResolveUrl(hfId, filename, hfRevision);

  let existingBytes = 0;
  try {
    const st = await stat(destPath);
    if (st.isFile() && st.size > 0) existingBytes = st.size;
  } catch {
    /* fresh download */
  }

  if (activeAbort) {
    throw new Error('Скачивание уже выполняется');
  }

  activeAbort = new AbortController();
  try {
    for (let resumeAttempt = 0; resumeAttempt < 2; resumeAttempt += 1) {
      const headers: Record<string, string> = {};
      if (existingBytes > 0) headers.Range = `bytes=${existingBytes}-`;

      let res: Response;
      try {
        res = await fetch(url, { signal: activeAbort.signal, headers });
      } catch (error) {
        if (isDownloadAbortError(error) || activeAbort.signal.aborted) {
          throw new Error('Загрузка отменена');
        }
        throw error;
      }
      if (!res.ok && res.status !== 206) {
        if (existingBytes > 0 && res.status === 416 && resumeAttempt === 0) {
          // Range past EOF usually means the file is already complete. Do not wipe it.
          if (existingBytes >= 1024 * 1024) {
            reportCombinedProgress(
              onProgress,
              progressOffset,
              progressWeight,
              1,
              existingBytes,
              existingBytes,
              false
            );
            return destPath;
          }
          await rm(destPath, { force: true });
          existingBytes = 0;
          continue;
        }
        throw new Error(`Не удалось скачать ${filename} (${res.status})`);
      }
      if (!res.body) {
        throw new Error(`Не удалось скачать ${filename} (пустой ответ)`);
      }

      const contentLength = Number(res.headers.get('content-length') || 0);
      const contentRange = res.headers.get('content-range');
      let total = contentLength + existingBytes;
      if (contentRange) {
        const match = /\/(\d+)\s*$/.exec(contentRange);
        if (match) total = Number.parseInt(match[1], 10);
      } else if (existingBytes === 0) {
        total = contentLength;
      }

      const remaining = Math.max(0, total - existingBytes);
      await assertEnoughDiskSpace(destDir, remaining);

      let received = existingBytes;
      const append = existingBytes > 0 && res.status === 206;
      const fileStream = createWriteStream(destPath, { flags: append ? 'a' : 'w' });
      let lastProgressAt = 0;

      const counter = new Transform({
        async transform(chunk: Buffer, _encoding, callback) {
          try {
            await waitWhilePaused();
            if (activeAbort?.signal.aborted) {
              callback(new Error('Загрузка отменена'));
              return;
            }
            received += chunk.length;
            const now = Date.now();
            if (total > 0 && (now - lastProgressAt >= 200 || received >= total)) {
              lastProgressAt = now;
              reportCombinedProgress(
                onProgress,
                progressOffset,
                progressWeight,
                received / total,
                received,
                total,
                true
              );
            }
            callback(null, chunk);
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        }
      });

      try {
        await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), counter, fileStream);
      } catch (err) {
        fileStream.destroy();
        if (activeAbort?.signal.aborted) {
          throw new Error('Загрузка отменена');
        }
        throw err;
      }

      if (total > 0) {
        reportCombinedProgress(onProgress, progressOffset, progressWeight, 1, total, total, false);
      } else {
        reportCombinedProgress(onProgress, progressOffset, progressWeight, 1, received, received, false);
      }

      return destPath;
    }

    throw new Error(`Не удалось скачать ${filename}`);
  } finally {
    activeAbort = null;
  }
}

export async function downloadGgufFile(
  userDataPath: string,
  hfId: string,
  filename: string,
  hfRevision: string | undefined,
  onProgress?: (info: DownloadProgressInfo) => void,
  progressOffset = 0,
  progressWeight = HF_FILE_PROGRESS_SCALE
): Promise<string> {
  return downloadHfFile(
    llamaModelsDir(userDataPath),
    hfId,
    filename,
    hfRevision,
    onProgress,
    progressOffset,
    progressWeight
  );
}

function catalogFiles(entry: ModelCatalogEntry): ModelFileSpec[] {
  if (entry.files?.length) return entry.files;
  const files: ModelFileSpec[] = [];
  if (entry.ggufFile) files.push({ name: entry.ggufFile, role: 'weights' });
  if (entry.mmprojFile) files.push({ name: entry.mmprojFile, role: 'mmproj' });
  return files;
}

export async function downloadGgufModel(
  userDataPath: string,
  entry: ModelCatalogEntry,
  onProgress?: (info: DownloadProgressInfo) => void
): Promise<string[]> {
  const files = catalogFiles(entry);
  if (files.length === 0) {
    throw new Error('Для этой модели не указаны файлы');
  }

  const destDir = catalogDestDir(userDataPath, entry);
  const destPaths: string[] = [];
  const combinedBytesTotal = Math.round(entry.sizeMb * 1024 * 1024);

  let completedBytes = 0;
  let peakPercent = 0;
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const hfId = file.hfId ?? entry.hfId;
    let fileBytes = 0;
    const dest = await downloadHfFile(
      destDir,
      hfId,
      file.name,
      entry.hfRevision,
      (info) => {
        fileBytes = info.bytesReceived ?? 0;
        const percent = Math.max(peakPercent, ggufOverallPercent(i, files.length, info.percent));
        peakPercent = percent;
        onProgress?.({
          percent,
          bytesReceived: completedBytes + fileBytes,
          bytesTotal: info.bytesTotal != null ? completedBytes + info.bytesTotal : combinedBytesTotal
        });
      }
    );
    completedBytes += fileBytes;
    destPaths.push(dest);
  }

  onProgress?.({ percent: 100, bytesReceived: Math.max(completedBytes, combinedBytesTotal), bytesTotal: combinedBytesTotal });
  return destPaths;
}
