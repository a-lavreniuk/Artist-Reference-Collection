import { describe, expect, it } from 'vitest';
import {
  DISPLAY_SCALE_PCT_MAX,
  DISPLAY_SCALE_PCT_MIN,
  clampPan,
  computeFitScale,
  displayPctToScale,
  isViewportAtActual,
  isViewportAtFit,
  normalizeViewport,
  scaleToDisplayPct,
  setDisplayPctAtCenter,
  setScaleAtCenter,
  viewportAtActualSize,
  zoomAtPoint
} from '../hooks/imageViewportZoomMath';

const stage = { width: 800, height: 600 };
const natural = { width: 1600, height: 1200 };

describe('imageViewportZoomMath', () => {
  it('computes fit scale from stage and natural size', () => {
    expect(computeFitScale(stage, natural)).toBe(0.5);
  });

  it('maps fit scale to 100% display', () => {
    const fitScale = 0.5;
    expect(scaleToDisplayPct(fitScale, fitScale)).toBe(100);
  });

  it('maps 10x fit scale to 1000% display', () => {
    const fitScale = 0.5;
    expect(scaleToDisplayPct(fitScale * 10, fitScale)).toBe(1000);
  });

  it('converts display percent back to scale', () => {
    const fitScale = 0.25;
    expect(displayPctToScale(250, fitScale)).toBeCloseTo(0.625);
    expect(displayPctToScale(DISPLAY_SCALE_PCT_MIN, fitScale)).toBeCloseTo(fitScale);
    expect(displayPctToScale(DISPLAY_SCALE_PCT_MAX, fitScale)).toBeCloseTo(fitScale * 10);
  });

  it('zooms toward focal point', () => {
    const fitScale = computeFitScale(stage, natural);
    const start = { scale: fitScale, panX: 0, panY: 0 };
    const next = zoomAtPoint(stage, natural, start, fitScale, 400, 300, 2);
    expect(next.scale).toBeCloseTo(fitScale * 2);
    const backAtFocal = zoomAtPoint(stage, natural, next, fitScale, 400, 300, 0.5);
    expect(backAtFocal.scale).toBeCloseTo(fitScale);
    expect(backAtFocal.panX).toBeCloseTo(0, 1);
    expect(backAtFocal.panY).toBeCloseTo(0, 1);
  });

  it('sets display percent at stage center', () => {
    const fitScale = computeFitScale(stage, natural);
    const start = { scale: fitScale, panX: 0, panY: 0 };
    const next = setDisplayPctAtCenter(stage, natural, start, fitScale, 200);
    expect(scaleToDisplayPct(next.scale, fitScale)).toBe(200);
  });

  it('detects fit and actual viewport modes', () => {
    const fitScale = computeFitScale(stage, natural);
    const fit = { scale: fitScale, panX: 0, panY: 0 };
    const actual = viewportAtActualSize(stage, natural, fit, fitScale);
    expect(isViewportAtFit(fit, fitScale)).toBe(true);
    expect(isViewportAtActual(actual)).toBe(true);
  });

  it('clamps pan inside generous bounds', () => {
    const fitScale = computeFitScale(stage, natural);
    const scale = fitScale * 4;
    const clamped = clampPan(5000, 5000, stage, natural, scale);
    expect(clamped.panX).toBeLessThan(5000);
    expect(clamped.panY).toBeLessThan(5000);
  });

  it('recenters after zoom+pan when switching to actual size', () => {
    const fitScale = computeFitScale(stage, natural);
    const zoomed = zoomAtPoint(stage, natural, { scale: fitScale, panX: 0, panY: 0 }, fitScale, 400, 300, 4);
    const panned = { ...zoomed, panX: zoomed.panX + 120, panY: zoomed.panY - 80 };
    const actual = viewportAtActualSize(stage, natural, panned, fitScale);
    expect(actual.scale).toBeCloseTo(1);
    expect(actual.panX).toBe(0);
    expect(actual.panY).toBe(0);
  });

  it('zeros pan when normalizing back to fit after zoom+pan', () => {
    const fitScale = computeFitScale(stage, natural);
    const zoomed = setScaleAtCenter(
      stage,
      natural,
      { scale: fitScale, panX: 0, panY: 0 },
      fitScale,
      fitScale * 3
    );
    const panned = { ...zoomed, panX: zoomed.panX + 90, panY: zoomed.panY + 60 };
    const backToFit = setScaleAtCenter(stage, natural, panned, fitScale, fitScale);
    const normalized = normalizeViewport(stage, natural, backToFit, fitScale);
    expect(normalized.scale).toBeCloseTo(fitScale);
    expect(normalized.panX).toBe(0);
    expect(normalized.panY).toBe(0);
  });

  it('keeps focal pan offset for micro-zoom above fit', () => {
    const fitScale = computeFitScale(stage, natural);
    const start = { scale: fitScale, panX: 0, panY: 0 };
    const zoomed = zoomAtPoint(stage, natural, start, fitScale, 100, 80, 1.02);
    const normalized = normalizeViewport(stage, natural, zoomed, fitScale);
    expect(normalized.scale).toBeGreaterThan(fitScale);
    expect(Math.abs(normalized.panX) + Math.abs(normalized.panY)).toBeGreaterThan(0);
  });
});
