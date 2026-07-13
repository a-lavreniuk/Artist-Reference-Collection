import { describe, expect, it } from 'vitest';
import { canPickVideoPreviewFrame, formatPreviewFrameMs } from './videoPreviewFrame';
import type { CardRecord } from '../../services/arcSchema';

function videoCard(format = 'mp4'): CardRecord {
  return {
    id: 'v1',
    type: 'video',
    addedAt: '2026-01-01T00:00:00.000Z',
    originalRelativePath: 'cards/v1/original.mp4',
    thumbRelativePath: 'cards/v1/thumb_s.webp',
    tagIds: [],
    collectionIds: [],
    format
  };
}

describe('canPickVideoPreviewFrame', () => {
  it('allows mp4 video', () => {
    expect(canPickVideoPreviewFrame(videoCard('mp4'))).toBe(true);
  });

  it('rejects gif and image', () => {
    expect(canPickVideoPreviewFrame(videoCard('gif'))).toBe(false);
    expect(canPickVideoPreviewFrame({ ...videoCard(), type: 'image' })).toBe(false);
  });
});

describe('formatPreviewFrameMs', () => {
  it('formats mm:ss', () => {
    expect(formatPreviewFrameMs(0)).toBe('0:00');
    expect(formatPreviewFrameMs(65000)).toBe('1:05');
  });
});
