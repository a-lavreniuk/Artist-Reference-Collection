import { describe, expect, it } from 'vitest';

import { isYoutubeUrl } from '../youtubeDownload';

describe('isYoutubeUrl', () => {
  it('accepts watch, shorts, and youtu.be URLs', () => {
    expect(isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYoutubeUrl('https://www.youtube.com/shorts/abc123')).toBe(true);
    expect(isYoutubeUrl('https://m.youtube.com/watch?v=abc')).toBe(true);
  });

  it('rejects non-video pages', () => {
    expect(isYoutubeUrl('https://www.youtube.com/channel/abc')).toBe(false);
    expect(isYoutubeUrl('https://example.com/watch?v=abc')).toBe(false);
    expect(isYoutubeUrl('not-a-url')).toBe(false);
  });
});
