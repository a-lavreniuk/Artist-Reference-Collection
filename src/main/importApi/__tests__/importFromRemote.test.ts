import { describe, expect, it } from 'vitest';

import { isHlsUrl } from '../importFromRemote';

describe('isHlsUrl', () => {
  it('detects .m3u8 by URL path', () => {
    expect(isHlsUrl('https://v.pinimg.com/videos/mc/hls/aa/bb/cc/playlist.m3u8')).toBe(true);
    expect(isHlsUrl('https://v.pinimg.com/videos/mc/hls/aa/bb/cc/playlist.m3u8?token=1')).toBe(true);
    expect(isHlsUrl('https://v.pinimg.com/videos/mc/hls/AA/BB/CC/PLAYLIST.M3U8')).toBe(true);
  });

  it('does not treat direct media URLs as HLS', () => {
    expect(isHlsUrl('https://v.pinimg.com/videos/mc/720p/aa/bb/cc/clip.mp4')).toBe(false);
    expect(isHlsUrl('https://i.pinimg.com/originals/aa/bb/cc/image.jpg')).toBe(false);
  });

  it('detects HLS by content-type when URL is ambiguous', () => {
    expect(isHlsUrl('https://cdn.example.com/stream', 'application/vnd.apple.mpegurl')).toBe(true);
    expect(isHlsUrl('https://cdn.example.com/stream', 'application/x-mpegURL; charset=utf-8')).toBe(true);
    expect(isHlsUrl('https://cdn.example.com/stream', 'video/mp4')).toBe(false);
  });

  it('handles invalid URLs without throwing', () => {
    expect(isHlsUrl('not a url')).toBe(false);
  });
});
