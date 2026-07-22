import { describe, expect, it } from 'vitest';

import { MAX_IMPORT_IMAGE_BYTES, MAX_IMPORT_VIDEO_BYTES } from '../constants';
import { isHlsUrl, isRetryableDownloadError } from '../importFromRemote';
import {
  isImageImportUrl,
  isVideoImportUrl,
  resolveImportMaxBytes,
  resolveImportMediaKind
} from '../importMediaKind';

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

describe('isRetryableDownloadError', () => {
  it('retries on fetch failed and timeout causes', () => {
    expect(isRetryableDownloadError(new Error('fetch failed'))).toBe(true);
    const timedOut = new Error('fetch failed') as Error & { cause?: unknown };
    timedOut.cause = new Error('Connect Timeout Error');
    expect(isRetryableDownloadError(timedOut)).toBe(true);
  });

  it('does not retry on HTTP-style application errors', () => {
    expect(isRetryableDownloadError(new Error('Download failed: HTTP 404'))).toBe(false);
    expect(isRetryableDownloadError(new Error('File too large'))).toBe(false);
  });
});

describe('importMediaKind', () => {
  it('classifies video URLs', () => {
    expect(isVideoImportUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isVideoImportUrl('https://v.pinimg.com/videos/mc/720p/aa/bb/cc/clip.mp4')).toBe(true);
    expect(isVideoImportUrl('https://cdn.example.com/stream.m3u8')).toBe(true);
    expect(isImageImportUrl('https://i.pinimg.com/originals/aa/bb/cc/image.jpg')).toBe(true);
  });

  it('uses explicit mediaKind when provided', () => {
    expect(resolveImportMediaKind('https://example.com/file.bin', 'video')).toBe('video');
    expect(resolveImportMediaKind('https://example.com/photo.jpg', 'image')).toBe('image');
  });

  it('applies 100MB image cap and 512MB video cap', () => {
    expect(resolveImportMaxBytes('https://example.com/photo.jpg')).toBe(MAX_IMPORT_IMAGE_BYTES);
    expect(resolveImportMaxBytes('https://example.com/clip.mp4')).toBe(MAX_IMPORT_VIDEO_BYTES);
    expect(resolveImportMaxBytes('https://www.youtube.com/watch?v=abc')).toBe(MAX_IMPORT_VIDEO_BYTES);
  });
});
