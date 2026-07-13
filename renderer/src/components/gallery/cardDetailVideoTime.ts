export const VIDEO_PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export type VideoPlaybackRate = (typeof VIDEO_PLAYBACK_RATES)[number];

export const DEFAULT_VIDEO_FPS = 30;

export function formatVideoClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  }
  return `${m}:${ss}`;
}

export function formatPlaybackRate(rate: number): string {
  if (rate === 1) return '1×';
  return `${rate}×`;
}

export function clampPlaybackRate(rate: number): VideoPlaybackRate {
  const sorted = VIDEO_PLAYBACK_RATES;
  let closest: VideoPlaybackRate = 1;
  let minDiff = Infinity;
  for (const candidate of sorted) {
    const diff = Math.abs(candidate - rate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return closest;
}

export function stepPlaybackRate(current: number, direction: 1 | -1): VideoPlaybackRate {
  const rates = VIDEO_PLAYBACK_RATES;
  const idx = rates.indexOf(clampPlaybackRate(current));
  const nextIdx = Math.max(0, Math.min(rates.length - 1, idx + direction));
  return rates[nextIdx] ?? 1;
}

export function msToRatio(ms: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, ms / durationMs));
}

export function ratioToMs(ratio: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return Math.max(0, Math.min(durationMs, Math.round(ratio * durationMs)));
}

export function formatVideoResolution(width?: number, height?: number): string {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return '—';
  }
  return `${Math.round(width)}×${Math.round(height)}`;
}

export function formatVideoFileSizeMb(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(1)} Мб`;
}
