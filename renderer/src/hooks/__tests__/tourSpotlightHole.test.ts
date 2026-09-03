import { describe, expect, it } from 'vitest';
import { computeTourSpotlightHole, paintTourSpotlight } from '../tourSpotlightHole';

describe('computeTourSpotlightHole', () => {
  it('expands the anchor by padding on each side', () => {
    const hole = computeTourSpotlightHole({ top: 40, left: 20, width: 32, height: 32 }, 6, 8);
    expect(hole).toEqual({
      top: 34,
      left: 14,
      width: 44,
      height: 44,
      radius: 14
    });
  });

  it('uses a 64px gutter around the highlighted object', () => {
    const hole = computeTourSpotlightHole({ top: 100, left: 80, width: 40, height: 24 }, 64, 8);
    expect(hole.top).toBe(36);
    expect(hole.left).toBe(16);
    expect(hole.width).toBe(168);
    expect(hole.height).toBe(152);
  });

  it('caps radius so it cannot exceed half of the hole', () => {
    const hole = computeTourSpotlightHole({ top: 0, left: 0, width: 10, height: 8 }, 0, 20);
    expect(hole.radius).toBe(4);
  });
});

describe('paintTourSpotlight', () => {
  it('cuts the hole with a CSS blur so the inner edge is soft', () => {
    const filters: string[] = [];
    const roundRect = { x: 0, y: 0, w: 0, h: 0, r: 0 };
    const ctx = {
      filter: 'none',
      fillStyle: '',
      globalCompositeOperation: 'source-over',
      clearRect() {},
      fillRect() {},
      beginPath() {},
      roundRect(x: number, y: number, w: number, h: number, r: number) {
        roundRect.x = x;
        roundRect.y = y;
        roundRect.w = w;
        roundRect.h = h;
        roundRect.r = r as number;
      },
      fill() {
        filters.push(this.filter);
      }
    } as unknown as CanvasRenderingContext2D;

    paintTourSpotlight(
      ctx,
      { width: 200, height: 100 },
      { top: 10, left: 8, width: 40, height: 24, radius: 6 },
      32,
      'rgba(0,0,0,0.8)'
    );

    expect(filters).toContain('blur(32px)');
    expect(ctx.filter).toBe('none');
    expect(roundRect).toEqual({ x: 8, y: 10, w: 40, h: 24, r: 6 });
  });
});
