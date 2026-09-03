export type TourSpotlightHole = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
};

export const TOUR_SPOTLIGHT_PADDING_FALLBACK_PX = 64;
export const TOUR_SPOTLIGHT_RADIUS_FALLBACK_PX = 8;
export const TOUR_SPOTLIGHT_BLUR_FALLBACK_PX = 32;

export function computeTourSpotlightHole(
  anchor: { top: number; left: number; width: number; height: number },
  paddingPx: number,
  radiusPx: number
): TourSpotlightHole {
  const padding = Math.max(0, paddingPx);
  const width = Math.max(0, anchor.width + padding * 2);
  const height = Math.max(0, anchor.height + padding * 2);
  const maxRadius = Math.max(0, Math.min(width, height) / 2);
  return {
    top: anchor.top - padding,
    left: anchor.left - padding,
    width,
    height,
    radius: Math.min(Math.max(0, radiusPx + padding), maxRadius)
  };
}

export function readTourSpotlightPaddingPx(): number {
  return readCssLengthPx('--s-4', 32) * 2;
}

export function readTourSpotlightBlurPx(): number {
  return readCssLengthPx('--s-4', TOUR_SPOTLIGHT_BLUR_FALLBACK_PX);
}

export function paintTourSpotlight(
  ctx: CanvasRenderingContext2D,
  viewport: { width: number; height: number },
  hole: TourSpotlightHole,
  blurPx: number,
  fillStyle: string
): void {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.globalCompositeOperation = 'destination-out';
  const blur = Math.max(0, blurPx);
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  const radius = Math.min(hole.radius, hole.width / 2, hole.height / 2);
  ctx.beginPath();
  ctx.roundRect(hole.left, hole.top, hole.width, hole.height, Math.max(0, radius));
  ctx.fill();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
}

export function readCssLengthPx(token: string, fallbackPx: number): number {
  if (typeof document === 'undefined') return fallbackPx;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallbackPx;
}

export function readElementRadiusPx(element: HTMLElement, fallbackPx: number): number {
  const raw = getComputedStyle(element).borderTopLeftRadius;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackPx;
}
