export type HfProgressEvent = {
  status?: string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

export type AggregatedDownloadProgress = {
  percent: number;
  bytesReceived: number;
  bytesTotal: number;
};

function ratioFromProgress(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  const ratio = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * CLIP / transformers качает несколько файлов, каждый со своим 0–100.
 * Складываем байты и не даём общему проценту падать.
 */
export function createHfDownloadProgressAggregator(estimatedBytes: number): {
  ingest: (event: HfProgressEvent) => AggregatedDownloadProgress;
  reset: () => void;
} {
  const files = new Map<string, { loaded: number; total: number }>();
  let peakPercent = 0;
  let peakBytes = 0;
  let anonSeq = 0;
  let lastAnonRatio = 0;

  const reset = (): void => {
    files.clear();
    peakPercent = 0;
    peakBytes = 0;
    anonSeq = 0;
    lastAnonRatio = 0;
  };

  const ingest = (event: HfProgressEvent): AggregatedDownloadProgress => {
    let key = String(event.file || event.name || '').trim();
    if (!key) {
      const ratio = typeof event.progress === 'number' ? ratioFromProgress(event.progress) : 0;
      if (ratio < 0.08 && lastAnonRatio > 0.45) {
        anonSeq += 1;
      }
      lastAnonRatio = ratio;
      key = `__anon-${anonSeq}`;
    }

    const prev = files.get(key) ?? { loaded: 0, total: 0 };
    let total = prev.total;
    let loaded = prev.loaded;

    if (typeof event.total === 'number' && event.total > 0) total = event.total;
    if (typeof event.loaded === 'number' && event.loaded >= 0) loaded = event.loaded;
    else if (typeof event.progress === 'number') {
      const ratio = ratioFromProgress(event.progress);
      if (total > 0) loaded = Math.max(loaded, ratio * total);
      else loaded = Math.max(loaded, ratio);
    }

    if (event.status === 'done' || event.status === 'ready') {
      loaded = total > 0 ? Math.max(loaded, total) : Math.max(loaded, 1);
    }

    files.set(key, { loaded, total });

    let loadedSum = 0;
    let knownTotal = 0;
    for (const file of files.values()) {
      loadedSum += file.loaded;
      knownTotal += file.total > 0 ? Math.max(file.total, file.loaded) : 0;
    }

    const bytesTotal = Math.max(knownTotal, estimatedBytes, 1);
    const bytesReceived = Math.max(peakBytes, loadedSum);
    peakBytes = bytesReceived;
    const rawPercent = Math.max(0, Math.min(100, Math.round((bytesReceived / bytesTotal) * 100)));
    const percent = Math.max(peakPercent, rawPercent);
    peakPercent = percent;

    return { percent, bytesReceived, bytesTotal };
  };

  return { ingest, reset };
}
