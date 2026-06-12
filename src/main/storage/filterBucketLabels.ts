export type NumericDistribution = {

  min: number;

  max: number;

  p25: number;

  p50: number;

  p75: number;

};



export type WeightSegment = {

  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';

  label: string;

  minMb: number;

  maxMb: number;

};



export type DurationSegment = {

  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';

  label: string;

  minMs: number;

  maxMs: number;

};



export type FileWeightMeta = {

  minMb: number;

  maxMb: number;

  segments: WeightSegment[];

};



export type DurationMeta = {

  minSec: number;

  maxSec: number;

  maxDurationMs: number;

  segments: DurationSegment[];

};



export type ResolutionSegment = {

  key: 'bucket1' | 'bucket2' | 'bucket3' | 'bucket4';

  label: string;

  minPx: number;

  maxPx: number;

  openEnd?: boolean;

};



export type ResolutionFineBucket = {

  minPx: number;

  maxPx: number;

  count: number;

  openEnd?: boolean;

};



export type ResolutionMeta = {

  minPx: number;

  maxPx: number;

  segments: ResolutionSegment[];

};



const MB_GRID = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

const SECOND_GRID = [

  5, 10, 15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 10_800,

  14_400

] as const;



export const PIXEL_GRID = [

  480, 720, 1080, 1280, 1440, 1920, 2048, 2560, 2880, 3840, 4096, 5120, 7680

] as const;



function nearestGrid(value: number, grid: readonly number[]): number {

  if (!Number.isFinite(value) || value <= 0) return grid[0];

  let best = grid[0];

  let bestDist = Math.abs(value - best);

  for (const g of grid) {

    const d = Math.abs(value - g);

    if (d < bestDist) {

      best = g;

      bestDist = d;

    }

  }

  return best;

}



export function snapNiceMb(value: number, minBound: number, maxBound: number): number {

  if (!Number.isFinite(value) || value <= 0) return Math.max(1, Math.round(minBound));

  const snapped = nearestGrid(Math.round(value), MB_GRID);

  return Math.max(Math.round(minBound), Math.min(Math.round(maxBound), snapped));

}



export function snapNiceSeconds(value: number, minBound: number, maxBound: number): number {

  if (!Number.isFinite(value) || value <= 0) return Math.max(1, Math.round(minBound));

  const snapped = nearestGrid(Math.round(value), SECOND_GRID);

  return Math.max(Math.round(minBound), Math.min(Math.round(maxBound), snapped));

}



export function formatMbDisplay(mb: number): string {

  return String(Math.round(mb));

}



export function formatDurationSecondsDisplay(totalSec: number): string {

  const sec = Math.max(0, Math.round(totalSec));

  if (sec >= 3600) {

    const hours = Math.floor(sec / 3600);

    const restMin = Math.round((sec % 3600) / 60);

    if (restMin === 0) return `${hours} ч`;

    return `${hours} ч ${restMin} мин`;

  }

  if (sec >= 60) {

    const min = Math.floor(sec / 60);

    const restSec = sec % 60;

    if (restSec === 0) return `${min} мин`;

    return `${min} мин ${restSec} сек`;

  }

  return `${sec} сек`;

}



function weightLabelUp(maxMb: number): string {

  return `До ${formatMbDisplay(maxMb)} Мб`;

}



function weightLabelRange(minMb: number, maxMb: number): string {

  return `${formatMbDisplay(minMb)}–${formatMbDisplay(maxMb)} Мб`;

}



function weightLabelOver(minMb: number): string {

  return `Более ${formatMbDisplay(minMb)} Мб`;

}



function durationLabelUp(maxSec: number): string {

  return `До ${formatDurationSecondsDisplay(maxSec)}`;

}



function durationLabelRange(minSec: number, maxSec: number): string {

  return `${formatDurationSecondsDisplay(minSec)} – ${formatDurationSecondsDisplay(maxSec)}`;

}



function durationLabelOver(minSec: number): string {

  return `Более ${formatDurationSecondsDisplay(minSec)}`;

}



function formatPxDisplay(px: number): string {

  return String(Math.round(px));

}



function resolutionLabelUp(maxPx: number): string {

  return `До ${formatPxDisplay(maxPx)} px`;

}



function resolutionLabelRange(minPx: number, maxPx: number): string {

  return `${formatPxDisplay(minPx)}–${formatPxDisplay(maxPx)} px`;

}



function resolutionLabelOver(minPx: number): string {

  return `Более ${formatPxDisplay(minPx)} px`;

}



function enforceMonotonicThresholds(

  min: number,

  max: number,

  t1: number,

  t2: number,

  t3: number

): [number, number, number] {

  const span = Math.max(max - min, 1);

  const minGap = Math.max(1, Math.round(span / 20));

  let a = snapNiceMb(t1, min, max);

  let b = snapNiceMb(t2, min, max);

  let c = snapNiceMb(t3, min, max);

  a = Math.max(min + minGap, Math.min(a, max - minGap * 3));

  b = Math.max(a + minGap, Math.min(b, max - minGap * 2));

  c = Math.max(b + minGap, Math.min(c, max - minGap));

  return [a, b, c];

}



function enforceMonotonicSeconds(

  min: number,

  max: number,

  t1: number,

  t2: number,

  t3: number

): [number, number, number] {

  const span = Math.max(max - min, 1);

  const minGap = Math.max(1, Math.round(span / 20));

  let a = snapNiceSeconds(t1, min, max);

  let b = snapNiceSeconds(t2, min, max);

  let c = snapNiceSeconds(t3, min, max);

  a = Math.max(min + minGap, Math.min(a, max - minGap * 3));

  b = Math.max(a + minGap, Math.min(b, max - minGap * 2));

  c = Math.max(b + minGap, Math.min(c, max - minGap));

  return [a, b, c];

}



export function buildWeightSegments(dist: NumericDistribution | null): FileWeightMeta {

  if (!dist || dist.max <= 0) {

    return { minMb: 0, maxMb: 0, segments: [] };

  }

  const minMb = dist.min / (1024 * 1024);

  const maxMb = dist.max / (1024 * 1024);

  if (maxMb <= minMb) {

    return {

      minMb: roundMb(minMb),

      maxMb: roundMb(maxMb),

      segments: [

        {

          key: 'bucket1',

          label: weightLabelUp(maxMb),

          minMb: 0,

          maxMb: roundMb(maxMb)

        }

      ]

    };

  }

  const p25Mb = dist.p25 / (1024 * 1024);

  const p50Mb = dist.p50 / (1024 * 1024);

  const p75Mb = dist.p75 / (1024 * 1024);

  const [t1, t2, t3] = enforceMonotonicThresholds(minMb, maxMb, p25Mb, p50Mb, p75Mb);

  const segments: WeightSegment[] = [

    { key: 'bucket1', label: weightLabelUp(t1), minMb: 0, maxMb: roundMb(t1) },

    { key: 'bucket2', label: weightLabelRange(t1, t2), minMb: roundMb(t1), maxMb: roundMb(t2) },

    { key: 'bucket3', label: weightLabelRange(t2, t3), minMb: roundMb(t2), maxMb: roundMb(t3) },

    { key: 'bucket4', label: weightLabelOver(t3), minMb: roundMb(t3), maxMb: roundMb(maxMb) }

  ];

  return { minMb: roundMb(minMb), maxMb: roundMb(maxMb), segments };

}



export function buildDurationSegments(dist: NumericDistribution | null): DurationMeta {

  if (!dist || dist.max <= 0) {

    return { minSec: 0, maxSec: 0, maxDurationMs: 0, segments: [] };

  }

  const minSec = Math.max(1, Math.round(dist.min / 1000));

  const maxSec = Math.max(minSec, Math.round(dist.max / 1000));

  const maxDurationMs = dist.max;

  if (maxSec <= minSec) {

    return {

      minSec,

      maxSec,

      maxDurationMs,

      segments: [

        {

          key: 'bucket1',

          label: durationLabelUp(maxSec),

          minMs: 0,

          maxMs: dist.max

        }

      ]

    };

  }

  const p25Sec = Math.round(dist.p25 / 1000);

  const p50Sec = Math.round(dist.p50 / 1000);

  const p75Sec = Math.round(dist.p75 / 1000);

  const [t1, t2, t3] = enforceMonotonicSeconds(minSec, maxSec, p25Sec, p50Sec, p75Sec);

  const segments: DurationSegment[] = [

    {

      key: 'bucket1',

      label: durationLabelUp(t1),

      minMs: 0,

      maxMs: t1 * 1000

    },

    {

      key: 'bucket2',

      label: durationLabelRange(t1, t2),

      minMs: t1 * 1000,

      maxMs: t2 * 1000

    },

    {

      key: 'bucket3',

      label: durationLabelRange(t2, t3),

      minMs: t2 * 1000,

      maxMs: t3 * 1000

    },

    {

      key: 'bucket4',

      label: durationLabelOver(t3),

      minMs: t3 * 1000,

      maxMs: dist.max

    }

  ];

  return { minSec, maxSec, maxDurationMs, segments };

}



function resolutionSegmentLabel(bucket: ResolutionFineBucket): string {

  if (bucket.minPx === 0) return resolutionLabelUp(bucket.maxPx);

  if (bucket.openEnd) return resolutionLabelOver(bucket.minPx);

  return resolutionLabelRange(bucket.minPx, bucket.maxPx);

}



export function buildResolutionSegmentsFromFineBuckets(

  fine: ResolutionFineBucket[],

  minPx: number,

  maxPx: number,

  maxSegments = 4

): ResolutionMeta {

  if (maxPx <= 0 || fine.length === 0) {

    return { minPx: 0, maxPx: 0, segments: [] };

  }

  let active = fine.map((b) => ({ ...b }));

  const countNonZero = () => active.filter((b) => b.count > 0).length;

  while (countNonZero() > maxSegments) {

    let bestI = -1;

    let bestSum = Infinity;

    for (let i = 0; i < active.length - 1; i++) {

      if (active[i].count === 0 && active[i + 1].count === 0) continue;

      const sum = active[i].count + active[i + 1].count;

      if (sum < bestSum) {

        bestSum = sum;

        bestI = i;

      }

    }

    if (bestI < 0) break;

    const merged: ResolutionFineBucket = {

      minPx: active[bestI].minPx,

      maxPx: active[bestI + 1].maxPx,

      count: active[bestI].count + active[bestI + 1].count,

      openEnd: active[bestI + 1].openEnd

    };

    active = [...active.slice(0, bestI), merged, ...active.slice(bestI + 2)];

  }

  const keys = ['bucket1', 'bucket2', 'bucket3', 'bucket4'] as const;

  const segments = active

    .filter((b) => b.count > 0)

    .map((b, i) => ({

      key: keys[i],

      label: resolutionSegmentLabel(b),

      minPx: b.minPx,

      maxPx: b.maxPx,

      openEnd: b.openEnd

    }));

  return { minPx, maxPx, segments };

}



function roundMb(v: number): number {

  return Math.round(v);

}



export function fileWeightMetaHint(meta: FileWeightMeta): string {

  if (meta.maxMb <= 0) return '';

  return `Файлы в библиотеке: ${formatMbDisplay(meta.minMb)}–${formatMbDisplay(meta.maxMb)} Мб`;

}



export function durationMetaHint(meta: DurationMeta): string {

  if (meta.maxSec <= 0) return '';

  return `Видео в библиотеке: ${formatDurationSecondsDisplay(meta.minSec)} – ${formatDurationSecondsDisplay(meta.maxSec)}`;

}



export function resolutionMetaHint(meta: ResolutionMeta): string {

  if (meta.maxPx <= 0) return '';

  return `Файлы в библиотеке: ${formatPxDisplay(meta.minPx)}–${formatPxDisplay(meta.maxPx)} px`;

}


