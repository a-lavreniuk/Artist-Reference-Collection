import { describe, expect, it } from 'vitest';
import { applyViewerWheelZoom, clampViewerZoomFactor, effectiveViewerScale } from './cardViewerWheelZoom';

describe('cardViewerWheelZoom', () => {
  it('computes fit scale as contain', () => {
    expect(
      effectiveViewerScale({ kind: 'fit' }, { width: 200, height: 100 }, { width: 400, height: 100 })
    ).toBe(0.5);
    expect(effectiveViewerScale({ kind: 'actual' }, { width: 200, height: 100 }, { width: 400, height: 100 })).toBe(
      1
    );
    expect(
      effectiveViewerScale({ kind: 'scale', factor: 1.5 }, { width: 200, height: 100 }, { width: 400, height: 100 })
    ).toBe(1.5);
  });

  it('clamps zoom factor', () => {
    expect(clampViewerZoomFactor(0.01)).toBe(0.1);
    expect(clampViewerZoomFactor(100)).toBe(10);
  });

  it('zooms toward focal point and keeps it stable', () => {
    const before = {
      zoomMode: { kind: 'scale' as const, factor: 1 },
      pan: { x: 0, y: 0 },
      stage: { width: 200, height: 200 },
      natural: { width: 100, height: 100 },
      focalX: 150,
      focalY: 100,
      deltaY: -100
    };
    const after = applyViewerWheelZoom(before);
    expect(after.zoomMode.kind).toBe('scale');
    if (after.zoomMode.kind !== 'scale') return;
    expect(after.zoomMode.factor).toBeGreaterThan(1);

    const scaleBefore = 1;
    const scaleAfter = after.zoomMode.factor;
    const imgX = (before.focalX - 100 - before.pan.x) / scaleBefore;
    const imgY = (before.focalY - 100 - before.pan.y) / scaleBefore;
    const focalAfterX = 100 + after.pan.x + imgX * scaleAfter;
    const focalAfterY = 100 + after.pan.y + imgY * scaleAfter;
    expect(focalAfterX).toBeCloseTo(before.focalX, 5);
    expect(focalAfterY).toBeCloseTo(before.focalY, 5);
  });
});
