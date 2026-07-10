import type { CSSProperties } from 'react';

export type ViewerTransform = {
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  grayscale: boolean;
};

export const DEFAULT_VIEWER_TRANSFORM: ViewerTransform = {
  rotateDeg: 0,
  flipH: false,
  grayscale: false
};

export function rotateViewerTransform(transform: ViewerTransform): ViewerTransform {
  const next = ((transform.rotateDeg + 90) % 360) as ViewerTransform['rotateDeg'];
  return { ...transform, rotateDeg: next };
}

export function toggleViewerFlipH(transform: ViewerTransform): ViewerTransform {
  return { ...transform, flipH: !transform.flipH };
}

export function toggleViewerGrayscale(transform: ViewerTransform): ViewerTransform {
  return { ...transform, grayscale: !transform.grayscale };
}

export function viewerTransformStyle(transform: ViewerTransform): CSSProperties {
  const parts: string[] = [];
  if (transform.rotateDeg) parts.push(`rotate(${transform.rotateDeg}deg)`);
  if (transform.flipH) parts.push('scaleX(-1)');
  return {
    transform: parts.length > 0 ? parts.join(' ') : undefined,
    filter: transform.grayscale ? 'grayscale(1)' : undefined
  };
}
