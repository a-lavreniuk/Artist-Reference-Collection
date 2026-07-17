import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWER_TRANSFORM,
  rotateViewerTransform,
  rotateViewerTransformCcw,
  toggleViewerFlipH,
  toggleViewerFlipV,
  toggleViewerGrayscale,
  viewerTransformStyle
} from './cardViewerTransforms';

describe('cardViewerTransforms', () => {
  it('rotates clockwise in 90 degree steps', () => {
    expect(rotateViewerTransform(DEFAULT_VIEWER_TRANSFORM).rotateDeg).toBe(90);
    expect(rotateViewerTransform({ ...DEFAULT_VIEWER_TRANSFORM, rotateDeg: 270 }).rotateDeg).toBe(0);
  });

  it('rotates counter-clockwise in 90 degree steps', () => {
    expect(rotateViewerTransformCcw(DEFAULT_VIEWER_TRANSFORM).rotateDeg).toBe(270);
    expect(rotateViewerTransformCcw({ ...DEFAULT_VIEWER_TRANSFORM, rotateDeg: 90 }).rotateDeg).toBe(0);
  });

  it('toggles flip and grayscale', () => {
    expect(toggleViewerFlipH(DEFAULT_VIEWER_TRANSFORM).flipH).toBe(true);
    expect(toggleViewerFlipV(DEFAULT_VIEWER_TRANSFORM).flipV).toBe(true);
    expect(toggleViewerGrayscale(DEFAULT_VIEWER_TRANSFORM).grayscale).toBe(true);
  });

  it('builds css transform and filter', () => {
    expect(viewerTransformStyle({ rotateDeg: 90, flipH: true, flipV: true, grayscale: true })).toEqual({
      transform: 'rotate(90deg) scaleX(-1) scaleY(-1)',
      filter: 'grayscale(1)'
    });
  });
});
