import { describe, expect, it } from 'vitest';
import {
  findNearestPantones,
  findPantoneByCode,
  formatPantoneCode,
  pantoneToHex
} from '../pantoneColors';

describe('formatPantoneCode', () => {
  it('числовые коды — с дефисом', () => {
    expect(formatPantoneCode('185 C')).toBe('185-C');
    expect(formatPantoneCode('100 C')).toBe('100-C');
  });

  it('именованные коды — без изменений', () => {
    expect(formatPantoneCode('Warm Red C')).toBe('Warm Red C');
    expect(formatPantoneCode('Reflex Blue C')).toBe('Reflex Blue C');
  });
});

describe('findPantoneByCode / pantoneToHex', () => {
  it('находит по коду с пробелом, дефисом и префиксом', () => {
    const hex = pantoneToHex('185 C');
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(pantoneToHex('185-C')).toBe(hex);
    expect(pantoneToHex('pantone 185 c')).toBe(hex);
    expect(pantoneToHex('185')).toBe(hex);
  });

  it('несуществующий код — null', () => {
    expect(findPantoneByCode('zzz-999')).toBeNull();
    expect(pantoneToHex('')).toBeNull();
  });
});

describe('findNearestPantones', () => {
  it('возвращает не больше запрошенного числа', () => {
    const matches = findNearestPantones('#E4002B', 8);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(8);
  });

  it('точное совпадение hex записи — первым в списке', () => {
    const entry = findPantoneByCode('185 C');
    expect(entry).not.toBeNull();
    const nearest = findNearestPantones(entry!.hex, 1);
    expect(nearest[0]?.code).toBe('185 C');
  });

  it('некорректный hex — пустой список', () => {
    expect(findNearestPantones('nope', 8)).toEqual([]);
  });
});
