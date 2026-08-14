/** Лимит путей в очереди ручного импорта. */
export const IMPORT_QUEUE_MAX_PATHS = 500;

export type ImportQueueFilesJob = {
  kind: 'files';
  paths: string[];
  skipSourceFiles?: boolean;
  assignCollectionId?: string;
  deleteAfterImport?: boolean;
};

export type ImportQueueFoldersJob = {
  kind: 'folders';
  folderPaths: string[];
  plan: unknown;
  looseFiles: string[];
};

export type ImportQueueJob = ImportQueueFilesJob | ImportQueueFoldersJob;

export function countJobPaths(job: ImportQueueJob): number {
  if (job.kind === 'files') return job.paths.length;
  return job.folderPaths.length + job.looseFiles.length;
}

export function countQueuedPaths(jobs: ImportQueueJob[]): number {
  return jobs.reduce((sum, job) => sum + countJobPaths(job), 0);
}

export type EnqueueImportResult =
  | { ok: true; accepted: number; queuedTotal: number }
  | { ok: false; reason: 'blocked' | 'limit'; accepted: number; queuedTotal: number };

/**
 * Добавляет job в очередь с лимитом путей.
 * При переполнении принимает только вмещающуюся часть files-job; folders-job целиком отклоняется.
 */
export function tryEnqueueImportJob(
  queue: ImportQueueJob[],
  job: ImportQueueJob,
  options: { blocked: boolean; maxPaths?: number }
): EnqueueImportResult {
  const maxPaths = options.maxPaths ?? IMPORT_QUEUE_MAX_PATHS;
  if (options.blocked) {
    return { ok: false, reason: 'blocked', accepted: 0, queuedTotal: countQueuedPaths(queue) };
  }

  const used = countQueuedPaths(queue);
  const room = Math.max(0, maxPaths - used);

  if (job.kind === 'folders') {
    const need = countJobPaths(job);
    if (need > room) {
      return { ok: false, reason: 'limit', accepted: 0, queuedTotal: used };
    }
    queue.push(job);
    return { ok: true, accepted: need, queuedTotal: used + need };
  }

  if (job.paths.length === 0) {
    return { ok: true, accepted: 0, queuedTotal: used };
  }

  if (room <= 0) {
    return { ok: false, reason: 'limit', accepted: 0, queuedTotal: used };
  }

  const acceptedPaths = job.paths.slice(0, room);
  queue.push({
    kind: 'files',
    paths: acceptedPaths,
    skipSourceFiles: job.skipSourceFiles,
    assignCollectionId: job.assignCollectionId,
    deleteAfterImport: job.deleteAfterImport
  });
  const accepted = acceptedPaths.length;
  const queuedTotal = used + accepted;
  if (accepted < job.paths.length) {
    return { ok: false, reason: 'limit', accepted, queuedTotal };
  }
  return { ok: true, accepted, queuedTotal };
}

export function formatImportEta(etaMs: number | null | undefined): string | null {
  if (etaMs == null || !Number.isFinite(etaMs) || etaMs <= 0) return null;
  const totalSec = Math.round(etaMs / 1000);
  if (totalSec < 60) return `~${Math.max(1, totalSec)} сек`;
  const min = Math.round(totalSec / 60);
  return `~${Math.max(1, min)} мин`;
}

export function pluralFilesRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'файлов';
  if (last === 1) return 'файл';
  if (last >= 2 && last <= 4) return 'файла';
  return 'файлов';
}

export function baseNameFromPath(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
