import { describe, expect, it } from 'vitest';
import { mediaMetaFormatters } from '../mediaFileMeta';

describe('mediaMetaFormatters', () => {
  it('maps sharp depth to Russian labels', () => {
    expect(mediaMetaFormatters.mapSharpDepth('uchar')).toBe('8 бит');
    expect(mediaMetaFormatters.mapSharpDepth('ushort')).toBe('16 бит');
  });

  it('formats aperture and shutter', () => {
    expect(mediaMetaFormatters.formatAperture(2.8)).toBe('f/2.8');
    expect(mediaMetaFormatters.formatShutterSpeed(1 / 250)).toBe('1/250');
    expect(mediaMetaFormatters.formatShutterSpeed(2)).toBe('2 с');
  });

  it('formats camera make/model without duplicate brand', () => {
    expect(mediaMetaFormatters.formatCamera('Canon', 'Canon EOS R5')).toBe('Canon EOS R5');
    expect(mediaMetaFormatters.formatCamera('Sony', 'ILCE-7M4')).toBe('Sony ILCE-7M4');
  });
});
