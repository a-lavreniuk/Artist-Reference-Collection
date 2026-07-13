import { describe, expect, it } from 'vitest';
import { parseSingleByteRange } from '../mediaServerRange';

describe('parseSingleByteRange', () => {
  it('returns null when header missing', () => {
    expect(parseSingleByteRange(undefined, 1000)).toBeNull();
  });

  it('parses closed range', () => {
    expect(parseSingleByteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
  });

  it('clamps end to file size', () => {
    expect(parseSingleByteRange('bytes=900-1500', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('parses open-ended range', () => {
    expect(parseSingleByteRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
  });

  it('parses suffix range', () => {
    expect(parseSingleByteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('returns unsatisfiable for out of bounds start', () => {
    expect(parseSingleByteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
  });
});
