import { describe, expect, it } from 'vitest';

import {
  buildPaletteFromPixels,
  PALETTE_MODE_CONFIG,
  scorePaletteMinDeltaE,
  type PaletteSwatch
} from '../paletteCore';
import { accuracyToMaxDeltaE } from '../../storage/colorSearch';

function solidPixels(r: number, g: number, b: number, count = 5000) {
  return Array.from({ length: count }, () => ({ r, g, b }));
}

function splitPixels(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }, leftPct = 50) {
  const leftCount = Math.round((leftPct / 100) * 10000);
  const rightCount = 10000 - leftCount;
  return [...solidPixels(left.r, left.g, left.b, leftCount), ...solidPixels(right.r, right.g, right.b, rightCount)];
}

function grayscaleGradient(count = 8000) {
  const pixels = [];
  for (let i = 0; i < count; i += 1) {
    const v = Math.round((i / (count - 1)) * 255);
    pixels.push({ r: v, g: v, b: v });
  }
  return pixels;
}

function colorfulMosaic(count = 12000) {
  const hues = [
    { r: 220, g: 40, b: 40 },
    { r: 40, g: 120, b: 220 },
    { r: 220, g: 180, b: 40 },
    { r: 80, g: 200, b: 90 },
    { r: 160, g: 60, b: 200 },
    { r: 240, g: 120, b: 60 },
    { r: 60, g: 180, b: 180 },
    { r: 200, g: 80, b: 140 }
  ];
  const pixels = [];
  for (let i = 0; i < count; i += 1) {
    const base = hues[i % hues.length]!;
    const jitter = (i % 7) - 3;
    pixels.push({
      r: Math.max(0, Math.min(255, base.r + jitter)),
      g: Math.max(0, Math.min(255, base.g + jitter)),
      b: Math.max(0, Math.min(255, base.b + jitter))
    });
  }
  return pixels;
}

describe('buildPaletteFromPixels', () => {
  it('collapses solid grayscale to one swatch in display mode', () => {
    const palette = buildPaletteFromPixels(solidPixels(128, 128, 128), 'display');
    expect(palette.length).toBeLessThanOrEqual(2);
    expect(palette[0]?.pct).toBe(100);
  });

  it('limits grayscale gradient swatches in display mode', () => {
    const palette = buildPaletteFromPixels(grayscaleGradient(), 'display');
    expect(palette.length).toBeLessThanOrEqual(2);
    const sum = palette.reduce((acc, row) => acc + row.pct, 0);
    expect(sum).toBe(100);
  });

  it('extracts two dominant colors for red/blue split', () => {
    const palette = buildPaletteFromPixels(splitPixels({ r: 210, g: 30, b: 30 }, { r: 30, g: 60, b: 210 }), 'display');
    expect(palette.length).toBeLessThanOrEqual(3);
    expect(palette.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps minor accent colors in search mode at 1% threshold', () => {
    const palette = buildPaletteFromPixels(
      splitPixels({ r: 200, g: 200, b: 200 }, { r: 208, g: 36, b: 36 }, 95),
      'search'
    );
    const hasRedAccent = palette.some((swatch) => scorePaletteMinDeltaE('#D02424', [swatch])! < 20);
    expect(hasRedAccent).toBe(true);
  });

  it('allows up to 20 swatches for colorful mosaic in search mode', () => {
    const palette = buildPaletteFromPixels(colorfulMosaic(), 'search');
    expect(palette.length).toBeGreaterThan(6);
    expect(palette.length).toBeLessThanOrEqual(PALETTE_MODE_CONFIG.search.maxColors);
    expect(palette.reduce((acc, row) => acc + row.pct, 0)).toBe(100);
  });

  it('returns fewer swatches in display mode than search for mosaic', () => {
    const pixels = colorfulMosaic();
    const display = buildPaletteFromPixels(pixels, 'display');
    const search = buildPaletteFromPixels(pixels, 'search');
    expect(display.length).toBeLessThanOrEqual(PALETTE_MODE_CONFIG.display.maxColors);
    expect(search.length).toBeGreaterThan(display.length);
  });

  it('never returns empty display palette for varied photo-like pixels', () => {
    const pixels = Array.from({ length: 5184 }, (_, i) => ({
      r: (i * 47 + 31) % 256,
      g: (i * 91 + 17) % 256,
      b: (i * 131 + 53) % 256
    }));
    const palette = buildPaletteFromPixels(pixels, 'display');
    expect(palette.length).toBeGreaterThan(0);
    expect(palette.length).toBeLessThanOrEqual(PALETTE_MODE_CONFIG.display.maxColors);
  });
});

describe('scorePaletteMinDeltaE', () => {
  it('matches closest swatch only (red accent vs neutral bulk)', () => {
    const palette: PaletteSwatch[] = [
      { hex: '#C8C8C8', pct: 95 },
      { hex: '#D02424', pct: 5 }
    ];
    const score = scorePaletteMinDeltaE('#D02424', palette);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(accuracyToMaxDeltaE(85));
  });
});

describe('accuracyToMaxDeltaE', () => {
  it('maps 85% tolerance to about 16 deltaE', () => {
    expect(accuracyToMaxDeltaE(85)).toBeCloseTo(16.25, 2);
  });
});
