import { describe, expect, it } from 'vitest';
import { __testOnly } from '../ffmpeg';

describe('buildFfmpegSeekArgs', () => {
  it('returns empty for first frame', () => {
    expect(__testOnly.buildFfmpegSeekArgs()).toEqual([]);
    expect(__testOnly.buildFfmpegSeekArgs(0)).toEqual([]);
  });

  it('formats seek position in seconds', () => {
    expect(__testOnly.buildFfmpegSeekArgs(1500)).toEqual(['-ss', '1.500']);
    expect(__testOnly.buildFfmpegSeekArgs(125000)).toEqual(['-ss', '125.000']);
  });
});
