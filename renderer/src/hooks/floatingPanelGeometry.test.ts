import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyMoveDelta,
  applyResizeDelta,
  centerPanelInViewport,
  clampPanelRect,
  clearFloatingPanelSessionStore,
  hitTestResizeEdge,
  readFloatingPanelSession,
  writeFloatingPanelSession
} from './floatingPanelGeometry';

const insets = { top: 32, right: 32, bottom: 32, left: 32 };
const viewport = { width: 1280, height: 800 };

describe('floatingPanelGeometry', () => {
  beforeEach(() => {
    clearFloatingPanelSessionStore();
  });

  it('centers panel in viewport with insets', () => {
    const rect = centerPanelInViewport({ width: 690, height: 400 }, viewport, insets);
    expect(rect.width).toBe(690);
    expect(rect.height).toBe(400);
    expect(rect.x).toBeCloseTo(32 + (1280 - 64 - 690) / 2);
    expect(rect.y).toBeCloseTo(32 + (800 - 64 - 400) / 2);
  });

  it('clamps size to min and keeps panel inside viewport', () => {
    const clamped = clampPanelRect(
      { x: -100, y: -50, width: 100, height: 50 },
      viewport,
      insets,
      690,
      400
    );
    expect(clamped.width).toBe(690);
    expect(clamped.height).toBe(400);
    expect(clamped.x).toBeGreaterThanOrEqual(insets.left);
    expect(clamped.y).toBeGreaterThanOrEqual(insets.top);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(viewport.width - insets.right);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(viewport.height - insets.bottom);
  });

  it('hit-tests corners over edges', () => {
    expect(hitTestResizeEdge(2, 2, 690, 400)).toBe('nw');
    expect(hitTestResizeEdge(688, 2, 690, 400)).toBe('ne');
    expect(hitTestResizeEdge(2, 398, 690, 400)).toBe('sw');
    expect(hitTestResizeEdge(688, 398, 690, 400)).toBe('se');
    expect(hitTestResizeEdge(345, 2, 690, 400)).toBe('n');
    expect(hitTestResizeEdge(688, 200, 690, 400)).toBe('e');
    expect(hitTestResizeEdge(345, 200, 690, 400)).toBeNull();
  });

  it('resizes from west and north by moving origin', () => {
    const start = { x: 100, y: 80, width: 690, height: 400 };
    const west = applyResizeDelta(start, 'w', -40, 0, 690, 400);
    expect(west.width).toBe(730);
    expect(west.x).toBe(60);
    expect(west.y).toBe(80);

    const north = applyResizeDelta(start, 'n', 0, -30, 690, 400);
    expect(north.height).toBe(430);
    expect(north.y).toBe(50);
    expect(north.x).toBe(100);
  });

  it('enforces min size when resizing from west/north', () => {
    const start = { x: 100, y: 80, width: 690, height: 400 };
    const west = applyResizeDelta(start, 'w', 100, 0, 690, 400);
    expect(west.width).toBe(690);
    expect(west.x).toBe(100);

    const north = applyResizeDelta(start, 'n', 0, 100, 690, 400);
    expect(north.height).toBe(400);
    expect(north.y).toBe(80);
  });

  it('applies move delta without changing size', () => {
    const start = { x: 10, y: 20, width: 690, height: 400 };
    expect(applyMoveDelta(start, 15, -5)).toEqual({
      x: 25,
      y: 15,
      width: 690,
      height: 400
    });
  });

  it('stores and reads session geometry by panelId', () => {
    writeFloatingPanelSession('card-detail-tags-picker', {
      x: 40,
      y: 50,
      width: 800,
      height: 500
    });
    expect(readFloatingPanelSession('card-detail-tags-picker')).toEqual({
      x: 40,
      y: 50,
      width: 800,
      height: 500
    });
    expect(readFloatingPanelSession('other')).toBeNull();
  });
});
