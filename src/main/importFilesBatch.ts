export type ImportBatchProgress = {
  current: number;
  total: number;
  message?: string;
  etaMs: number | null;
};

export type ImportBatchFileResult<TOk> =
  | { ok: true; row: TOk; path: string }
  | { ok: false; error: string; path: string };

export type ImportBatchOutcome<TOk> = {
  results: Array<ImportBatchFileResult<TOk>>;
  cancelled: boolean;
};

export type RunImportFilesBatchOptions<TOk> = {
  paths: string[];
  signal: AbortSignal;
  importOne: (absolutePath: string) => Promise<{ ok: true; row: TOk } | { ok: false; error: string }>;
  onProgress: (payload: ImportBatchProgress) => void;
  /** Скользящее окно для ETA (мс на файл). */
  etaWindowSize?: number;
  now?: () => number;
};

/**
 * Импорт списка файлов по одному.
 * Abort проверяется перед следующим файлом: текущий доводится до конца.
 */
export async function runImportFilesBatch<TOk>(
  options: RunImportFilesBatchOptions<TOk>
): Promise<ImportBatchOutcome<TOk>> {
  const {
    paths,
    signal,
    importOne,
    onProgress,
    etaWindowSize = 8,
    now = () => Date.now()
  } = options;

  const total = paths.length;
  const results: Array<ImportBatchFileResult<TOk>> = [];
  const durationsMs: number[] = [];

  const emit = (current: number, message?: string) => {
    const remaining = Math.max(0, total - current);
    let etaMs: number | null = null;
    if (durationsMs.length > 0 && remaining > 0) {
      const window = durationsMs.slice(-etaWindowSize);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      etaMs = Math.round(avg * remaining);
    }
    onProgress({
      current,
      total,
      message: message ?? `Добавлено ${current} из ${total}`,
      etaMs
    });
  };

  emit(0);

  for (let i = 0; i < paths.length; i++) {
    if (signal.aborted) {
      return { results, cancelled: true };
    }

    const absolutePath = paths[i];
    const started = now();
    const one = await importOne(absolutePath);
    durationsMs.push(Math.max(0, now() - started));

    if (one.ok) {
      results.push({ ok: true, row: one.row, path: absolutePath });
    } else {
      results.push({ ok: false, error: one.error, path: absolutePath });
    }

    emit(i + 1);
  }

  return { results, cancelled: false };
}
