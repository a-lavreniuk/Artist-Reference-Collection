import { describe, expect, it } from 'vitest';
import { clientToImagePixel, hexFromImageData, rgbToHex } from '../sampleColor';

describe('rgbToHex', () => {
  it('formats RGB as uppercase hex', () => {
    expect(rgbToHex(227, 184, 26)).toBe('#E3B81A');
  });

  it('clamps out of range channels', () => {
    expect(rgbToHex(-4, 300, 16.4)).toBe('#00FF10');
  });
});

describe('clientToImagePixel', () => {
  it('maps the top-left CSS pixel to image origin', () => {
    expect(clientToImagePixel(0, 0, 1920, 1080, 3840, 2160)).toEqual({ x: 0, y: 0 });
  });

  it('maps the bottom-right CSS pixel to the last image pixel', () => {
    expect(clientToImagePixel(1919, 1079, 1920, 1080, 3840, 2160)).toEqual({ x: 3838, y: 2158 });
  });

  it('clamps coordinates inside the bitmap', () => {
    expect(clientToImagePixel(-10, 5000, 800, 600, 800, 600)).toEqual({ x: 0, y: 599 });
  });
});

describe('hexFromImageData', () => {
  it('reads a packed RGBA pixel', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 227, 184, 26, 255]);
    expect(hexFromImageData(data, 1)).toBe('#E3B81A');
  });

  it('returns null past the buffer', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(hexFromImageData(data, 4)).toBeNull();
  });
});
