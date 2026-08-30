export type DownloadProgressPhase = 'runtime' | 'model' | 'finalize';

/** Не отбрасывать 0% модели после runtime 100%: смена фазы всегда принимается. */
export function shouldAcceptDownloadProgress(
  lastPhase: DownloadProgressPhase | null,
  lastPercent: number | null,
  nextPhase: DownloadProgressPhase,
  nextPercent: number
): boolean {
  if (lastPhase !== nextPhase) return true;
  if (lastPercent == null) return true;
  return nextPercent >= lastPercent;
}

/** CPU и CUDA на одной фазе runtime: не начинать CUDA с 50% после CPU 100%. */
export function mapRuntimePercent(percent: number, band: 'full' | 'lower' | 'upper'): number {
  const raw = Math.max(0, Math.min(100, Math.round(Number.isFinite(percent) ? percent : 0)));
  if (band === 'lower') return Math.round((raw * 50) / 100);
  if (band === 'upper') return 50 + Math.round((raw * 50) / 100);
  return raw;
}
