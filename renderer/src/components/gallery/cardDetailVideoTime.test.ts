import { describe, expect, it } from 'vitest';
import {
  formatVideoClock,
  formatVideoFileSizeMb,
  formatVideoResolution,
  stepPlaybackRate
} from './cardDetailVideoTime';

describe('formatVideoClock', () => {
  it('formats mm:ss', () => {
    expect(formatVideoClock(65)).toBe('1:05');
  });

  it('formats h:mm:ss', () => {
    expect(formatVideoClock(3661)).toBe('1:01:01');
  });
});

describe('stepPlaybackRate', () => {
  it('steps within available rates', () => {
    expect(stepPlaybackRate(1, 1)).toBe(1.25);
    expect(stepPlaybackRate(1, -1)).toBe(0.75);
  });
});

describe('formatVideoResolution', () => {
  it('formats width and height', () => {
    expect(formatVideoResolution(1920, 1440)).toBe('1920×1440');
  });

  it('returns dash when missing', () => {
    expect(formatVideoResolution(undefined, 1440)).toBe('—');
  });
});

describe('formatVideoFileSizeMb', () => {
  it('formats megabytes with one decimal', () => {
    expect(formatVideoFileSizeMb(3.6 * 1024 * 1024)).toBe('3.6 Мб');
  });

  it('returns dash when missing', () => {
    expect(formatVideoFileSizeMb(undefined)).toBe('—');
  });
});
