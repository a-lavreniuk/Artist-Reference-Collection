import { describe, expect, it } from 'vitest';
import {
  cmykToHex,
  hexToCmyk,
  hexToHsb,
  hexToHsl,
  hexToRgb,
  hslToHex,
  hsbToHex,
  normalizeColorHex,
  parseCmykChannels,
  parseHslChannels,
  parseHsbChannels,
  parseRgbChannels,
  rgbToHex
} from '../colorFormats';

describe('colorFormats', () => {
  it('normalizes hex', () => {
    expect(normalizeColorHex('#E4002B')).toBe('#E4002B');
    expect(normalizeColorHex('e4002b')).toBe('#E4002B');
  });

  it('converts hex to rgb and back', () => {
    const rgb = hexToRgb('#E4002B');
    expect(rgb).toEqual({ r: 228, g: 0, b: 43 });
    expect(rgbToHex(rgb!.r, rgb!.g, rgb!.b)).toBe('#E4002B');
  });

  it('parses rgb channels', () => {
    expect(parseRgbChannels('228', '0', '43')).toBe('#E4002B');
  });

  it('converts hex to cmyk and back approximately', () => {
    const cmyk = hexToCmyk('#E4002B');
    expect(cmyk).not.toBeNull();
    const back = cmykToHex(cmyk!.c, cmyk!.m, cmyk!.y, cmyk!.k);
    expect(back).toBeTruthy();
    const rgb1 = hexToRgb('#E4002B');
    const rgb2 = hexToRgb(back!);
    expect(Math.abs(rgb1!.r - rgb2!.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.g - rgb2!.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.b - rgb2!.b)).toBeLessThanOrEqual(2);
  });

  it('parses cmyk channels', () => {
    const hex = parseCmykChannels('0', '100', '81', '11');
    expect(hex).toBeTruthy();
  });

  it('converts hex to hsl and back', () => {
    const hsl = hexToHsl('#E4002B');
    expect(hsl).not.toBeNull();
    const back = hslToHex(hsl!.h, hsl!.s, hsl!.l);
    expect(back).toBeTruthy();
    const rgb1 = hexToRgb('#E4002B');
    const rgb2 = hexToRgb(back!);
    expect(Math.abs(rgb1!.r - rgb2!.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.g - rgb2!.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.b - rgb2!.b)).toBeLessThanOrEqual(2);
  });

  it('parses hsl channels', () => {
    const hsl = hexToHsl('#2663BE');
    expect(hsl).not.toBeNull();
    const back = parseHslChannels(String(hsl!.h), String(hsl!.s), String(hsl!.l));
    expect(back).toBeTruthy();
    const rgb1 = hexToRgb('#2663BE');
    const rgb2 = hexToRgb(back!);
    expect(Math.abs(rgb1!.r - rgb2!.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.g - rgb2!.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.b - rgb2!.b)).toBeLessThanOrEqual(2);
  });

  it('converts hex to hsb and back', () => {
    const hsb = hexToHsb('#E4002B');
    expect(hsb).not.toBeNull();
    const back = hsbToHex(hsb!.h, hsb!.s, hsb!.b);
    expect(back).toBeTruthy();
    const rgb1 = hexToRgb('#E4002B');
    const rgb2 = hexToRgb(back!);
    expect(Math.abs(rgb1!.r - rgb2!.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.g - rgb2!.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.b - rgb2!.b)).toBeLessThanOrEqual(2);
  });

  it('parses hsb channels', () => {
    const hsb = hexToHsb('#2663BE');
    expect(hsb).not.toBeNull();
    const back = parseHsbChannels(String(hsb!.h), String(hsb!.s), String(hsb!.b));
    expect(back).toBeTruthy();
    const rgb1 = hexToRgb('#2663BE');
    const rgb2 = hexToRgb(back!);
    expect(Math.abs(rgb1!.r - rgb2!.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.g - rgb2!.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb1!.b - rgb2!.b)).toBeLessThanOrEqual(2);
  });
});
