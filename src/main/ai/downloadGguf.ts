import { createWriteStream } from 'fs';
import { mkdir, rm, stat } from 'fs/promises';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import type { ModelCatalogEntry, ModelFileSpec } from './types';
import { llamaModelsDir } from './modelManager';

export type DownloadProgressInfo = {
  percent: number;
  bytesReceived?: number;
  bytesTotal?: number;
};

function hfResolveUrl(hfId: string, filename: string, hfRevision?: string): string {
  const revision = hfRevision?.trim() || 'main';
  return `https://huggingface.co/${hfId}/resolve/${revision}/${encodeURIComponent(filename)}`;
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

async function waitWhilePaused(): Promise<void> {
  while (downloadPaused) {
    await new Promise<void>((resolve) => {
      pauseWaiters.push(resolve);
    });
  }
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
  const combined = progressOffset + localRatio * progressWeight;
  const capped = capBelowComplete ? Math.min(combined, progressOffset + progressWeight * 0.995) : combined;
  onProgress({
    percent: Math.max(0, Math.min(100, Math.round(capped))),
    bytesReceived,
    bytesTotal: bytesTotal > 0 ? bytesTotal : undefined
  });
}

export async function downloadGgufFile(
  userDataPath: string,
  hfId: string,
  filename: string,
  hfRevision: string | undefined,
  onProgress?: (info: DownloadProgressInfo) => void,
  progressOffset = 0,
  progressWeight = 1
): Promise<string> {
  const dir = llamaModelsDir(userDataPath);
  await mkdir(dir, { recursive: true });
  const destPath = path.join(dir, filename);
  const url = hfResolveUrl(hfId, filename, hfRevision);

  let existingBytes = 0;
  try {
    const st = await stat(destPath);
    if (st.isFile() && st.size > 0) existingBytes = st.size;
  } catch {
    /* fresh download */
  }

  activeAbort = new AbortController();
  const headers: Record<string, string> = {};
  if (existingBytes > 0) headers.Range = `bytes=${existingBytes}-`;

  const res = await fetch(url, { signal: activeAbort.signal, headers });
  if (!res.ok && res.status !== 206) {
    if (existingBytes > 0 && res.status === 416) {
      await rm(destPath, { force: true });
      return downloadGgufFile(userDataPath, hfId, filename, hfRevision, onProgress, progressOffset, progressWeight);
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

  let received = existingBytes;
  const append = existingBytes > 0 && res.status === 206;
  const fileStream = createWriteStream(destPath, { flags: append ? 'a' : 'w' });

  const counter = new Transform({
    async transform(chunk: Buffer, _encoding, callback) {
      try {
        await waitWhilePaused();
        if (activeAbort?.signal.aborted) {
          callback(new Error('Загрузка отменена'));
          return;
        }
        received += chunk.length;
        if (total > 0) {
          reportCombinedProgress(
            onProgress,
            progressOffset,
            progressWeight,
            (received - existingBytes) / Math.max(total - existingBytes, 1),
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
  } finally {
    activeAbort = null;
  }

  if (total > 0) {
    reportCombinedProgress(onProgress, progressOffset, progressWeight, 1, total, total, false);
  } else {
    reportCombinedProgress(onProgress, progressOffset, progressWeight, 1, received, received, false);
  }

  return destPath;
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
    throw new Error('Для этой модели не указаны GGUF-файлы');
  }

  const destPaths: string[] = [];
  const weight = 100 / files.length;
  let combinedBytesTotal = 0;
  for (const file of files) {
    combinedBytesTotal += entry.sizeMb * 1024 * 1024 * (1 / files.length);
  }

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const hfId = file.hfId ?? entry.hfId;
    const dest = await downloadGgufFile(
      userDataPath,
      hfId,
      file.name,
      entry.hfRevision,
      (info) => {
        const fileOffset = i * weight;
        onProgress?.({
          percent: Math.max(0, Math.min(100, Math.round(fileOffset + (info.percent / 100) * weight))),
          bytesReceived: info.bytesReceived,
          bytesTotal: info.bytesTotal ?? Math.round(combinedBytesTotal)
        });
      },
      i * weight,
      weight
    );
    destPaths.push(dest);
  }

  onProgress?.({ percent: 100, bytesReceived: combinedBytesTotal, bytesTotal: combinedBytesTotal });
  return destPaths;
}
