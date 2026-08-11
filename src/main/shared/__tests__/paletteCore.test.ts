import { describe, expect, it } from 'vitest';

import {
  buildPaletteFromPixels,
  PALETTE_MODE_CONFIG,
  scorePaletteMinDeltaE,
  selectPaletteForDisplay,
  selectPaletteTopN,
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
  it('keeps scattered orange accents on a gray-heavy photo-like mosaic', () => {
    // Много близких серых корзин (топ по count) + оранжевый размазан по мелким оттенкам.
    const pixels: Array<{ r: number; g: number; b: number }> = [];
    for (let i = 0; i < 9000; i += 1) {
      const base = 140 + (i % 40);
      pixels.push({ r: base, g: base, b: base + (i % 3) });
    }
    for (let i = 0; i < 1200; i += 1) {
      pixels.push({
        r: 230 + (i % 20),
        g: 70 + (i % 35),
        b: 35 + (i % 25)
      });
    }
    for (let i = 0; i < 800; i += 1) {
      pixels.push({
        r: 230 + (i % 15),
        g: 180 + (i % 30),
        b: 30 + (i % 20)
      });
    }
    const palette = buildPaletteFromPixels(pixels, 'search');
    const hasOrange = palette.some((swatch) => scorePaletteMinDeltaE('#E85A30', [swatch])! < 35);
    const hasYellow = palette.some((swatch) => scorePaletteMinDeltaE('#E6B428', [swatch])! < 35);
    expect(palette.length).toBeGreaterThan(2);
    expect(hasOrange).toBe(true);
    expect(hasYellow).toBe(true);
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

describe('selectPaletteForDisplay (diversity greedy)', () => {
  const crowdedNeutralsWithAccent: PaletteSwatch[] = [
    { hex: '#E8E8E8', pct: 22 },
    { hex: '#D0D0D0', pct: 18 },
    { hex: '#B8B8B8', pct: 14 },
    { hex: '#A0A0A0', pct: 12 },
    { hex: '#888888', pct: 10 },
    { hex: '#707070', pct: 8 },
    { hex: '#585858', pct: 6 },
    { hex: '#404040', pct: 4 },
    { hex: '#E8E0D8', pct: 2 },
    { hex: '#D8D0C8', pct: 1 },
    { hex: '#C8C0B8', pct: 1 },
    { hex: '#B8B0A8', pct: 1 },
    { hex: '#D02424', pct: 1 }
  ];

  it('keeps a distant accent that top-N drops when max is tight', () => {
    const max = 8;
    const topN = selectPaletteTopN(crowdedNeutralsWithAccent, max);
    const greedy = selectPaletteForDisplay(crowdedNeutralsWithAccent, max);
    const topHasRed = topN.some((sw) => scorePaletteMinDeltaE('#D02424', [sw])! < 20);
    const greedyHasRed = greedy.some((sw) => scorePaletteMinDeltaE('#D02424', [sw])! < 20);
    expect(topHasRed).toBe(false);
    expect(greedyHasRed).toBe(true);
    expect(greedy.length).toBe(max);
  });

  it('respects CARD-style max of 12', () => {
    const greedy = selectPaletteForDisplay(crowdedNeutralsWithAccent, 12);
    expect(greedy.length).toBeLessThanOrEqual(12);
    expect(greedy.length).toBe(12);
  });

  it('returns all swatches when fewer than max (cannot invent colors)', () => {
    const small: PaletteSwatch[] = [
      { hex: '#112233', pct: 60 },
      { hex: '#AABBCC', pct: 40 }
    ];
    expect(selectPaletteForDisplay(small, 12)).toEqual(small);
  });

  it('fills exactly to max when enough candidates exist', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      hex: `#${(16 + i * 10).toString(16).padStart(2, '0')}${(32 + i * 8).toString(16).padStart(2, '0')}${(64 + i * 6).toString(16).padStart(2, '0')}`,
      pct: Math.max(1, 20 - i)
    }));
    expect(selectPaletteForDisplay(many, 12)).toHaveLength(12);
  });

  it('starts with the highest-pct swatch', () => {
    const greedy = selectPaletteForDisplay(crowdedNeutralsWithAccent, 5);
    expect(greedy[0]?.hex).toBe('#E8E8E8');
  });
});

describe('accuracyToMaxDeltaE', () => {
  it('maps 85% tolerance to about 16 deltaE', () => {
    expect(accuracyToMaxDeltaE(85)).toBeCloseTo(16.25, 2);
  });
});
