import type { ImageDupFingerprint } from './storage/types';

export const IMPORT_DUPLICATE_THRESHOLD_PCT = 95;
export const BACKGROUND_DUPLICATE_THRESHOLD_PCT = 95;

const STRUCT_WEIGHT = 0.7;
const HIST_WEIGHT = 0.3;

function hamming(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d += 1;
  d += Math.abs(a.length - b.length);
  return d;
}

function similarityBitsPct(hashA: string, hashB: string): number {
  const denom = Math.max(hashA.length, hashB.length, 1);
  return 100 * (1 - hamming(hashA, hashB) / denom);
}

function histogramSimilarityPct(a: number[], b: number[]): number {
  let l1 = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) l1 += Math.abs(a[i]! - b[i]!);
  return 100 * (1 - Math.min(1, l1 / 2));
}

export function similarityCombined(a: ImageDupFingerprint, b: ImageDupFingerprint): number {
  let bestStruct = 0;
  for (const ha of a.rotHashes) {
    for (const hb of b.rotHashes) {
      if (!ha || !hb) continue;
      bestStruct = Math.max(bestStruct, similarityBitsPct(ha, hb));
    }
  }
  const histSim = histogramSimilarityPct(a.hist, b.hist);
  return STRUCT_WEIGHT * bestStruct + HIST_WEIGHT * histSim;
}

export function isExactSha256(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}

export function matchKindFromSimilarity(similarity: number, exactSha256: boolean): 'exact' | 'similar' {
  if (exactSha256 || similarity >= 100) return 'exact';
  return 'similar';
}

export function meetsImportThreshold(similarity: number, exactSha256: boolean): boolean {
  if (exactSha256) return true;
  return similarity >= IMPORT_DUPLICATE_THRESHOLD_PCT;
}

export function meetsScanThreshold(similarity: number, exactSha256: boolean, thresholdPct: number): boolean {
  if (thresholdPct >= 100) return exactSha256 || similarity >= 100;
  if (exactSha256) return true;
  return similarity >= thresholdPct;
}

export function duplicateSimilarityHint(pct: number): string {
  const v = Math.max(50, Math.min(100, Math.round(pct)));
  if (v >= 100) return 'Только абсолютно идентичные файлы';
  if (v >= 95) return 'Почти точные копии и полные совпадения';
  if (v >= 85) return 'Сильно похожие изображения, возможны ложные срабатывания';
  if (v >= 70) return 'Расширенный поиск похожих изображений';
  return 'Максимально широкий поиск, больше шума';
}

export type QualityMetrics = {
  width?: number;
  height?: number;
  fileSize?: number;
};

export function compareQuality(a: QualityMetrics, b: QualityMetrics): number {
  const areaA = (a.width ?? 0) * (a.height ?? 0);
  const areaB = (b.width ?? 0) * (b.height ?? 0);
  if (areaA !== areaB) return areaA - areaB;
  return (a.fileSize ?? 0) - (b.fileSize ?? 0);
}

export function incomingIsBetter(incoming: QualityMetrics, existing: QualityMetrics): boolean {
  return compareQuality(incoming, existing) > 0;
}

export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}
