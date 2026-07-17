import { ZOOM_WHEEL_FACTOR } from '../hooks/imageViewportZoomMath';
import type { ViewerZoomMode } from './cardViewerZoom';
import type { CardViewerPan } from './cardViewerHistory';

export const VIEWER_ZOOM_FACTOR_MIN = 0.1;
export const VIEWER_ZOOM_FACTOR_MAX = 10;

export type ViewerStageSize = { width: number; height: number };
export type ViewerNaturalSize = { width: number; height: number };

/** Effective display scale relative to natural pixels (fit uses contain-in-stage). */
export function effectiveViewerScale(
  mode: ViewerZoomMode,
  stage: ViewerStageSize,
  natural: ViewerNaturalSize
): number {
  if (natural.width <= 0 || natural.height <= 0) return 1;
  if (mode.kind === 'actual') return 1;
  if (mode.kind === 'scale') return mode.factor;
  if (stage.width <= 0 || stage.height <= 0) return 1;
  return Math.min(stage.width / natural.width, stage.height / natural.height);
}

export function clampViewerZoomFactor(factor: number): number {
  if (!Number.isFinite(factor)) return 1;
  return Math.min(VIEWER_ZOOM_FACTOR_MAX, Math.max(VIEWER_ZOOM_FACTOR_MIN, factor));
}

export type ViewerWheelZoomResult = {
  zoomMode: ViewerZoomMode;
  pan: CardViewerPan;
};

/**
 * Zoom toward a point in stage-local coordinates (origin = stage top-left).
 * Uses the same wheel factor as the detail viewport.
 */
export function applyViewerWheelZoom(args: {
  zoomMode: ViewerZoomMode;
  pan: CardViewerPan;
  stage: ViewerStageSize;
  natural: ViewerNaturalSize;
  focalX: number;
  focalY: number;
  deltaY: number;
}): ViewerWheelZoomResult {
  const { zoomMode, pan, stage, natural, focalX, focalY, deltaY } = args;
  const currentScale = effectiveViewerScale(zoomMode, stage, natural);
  const factor = deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR;
  const nextScale = clampViewerZoomFactor(currentScale * factor);
  if (nextScale === currentScale) {
    return { zoomMode, pan };
  }

  const centerX = stage.width / 2;
  const centerY = stage.height / 2;
  const imgX = (focalX - centerX - pan.x) / currentScale;
  const imgY = (focalY - centerY - pan.y) / currentScale;

  return {
    zoomMode: { kind: 'scale', factor: nextScale },
    pan: {
      x: focalX - centerX - imgX * nextScale,
      y: focalY - centerY - imgY * nextScale
    }
  };
}

export { ZOOM_WHEEL_FACTOR };
