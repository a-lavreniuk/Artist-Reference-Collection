import { describe, expect, it, beforeEach } from 'vitest';
import {
  getGalleryCacheHit,
  invalidateAllGallerySnapshots,
  isGalleryCacheHit,
  setGallerySnapshot,
  type GalleryScopeSnapshot
} from './galleryScopeCache';

function emptySnapshot(overrides: Partial<GalleryScopeSnapshot> = {}): GalleryScopeSnapshot {
  return {
    cards: [],
    srcMap: {},
    offset: 0,
    hasMore: false,
    ...overrides
  };
}

describe('galleryScopeCache', () => {
  beforeEach(() => {
    invalidateAllGallerySnapshots();
  });

  it('не считает пустой snapshot cache hit без settled', () => {
    setGallerySnapshot('all||||{}|addedAt:desc', emptySnapshot());
    expect(isGalleryCacheHit(emptySnapshot())).toBe(false);
    expect(getGalleryCacheHit('all||||{}|addedAt:desc')).toBeUndefined();
  });

  it('считает пустой settled snapshot cache hit', () => {
    const key = 'all||||{}|addedAt:desc';
    setGallerySnapshot(key, emptySnapshot({ settled: true }));
    expect(getGalleryCacheHit(key)).toBeDefined();
  });

  it('считает непустой snapshot cache hit без settled', () => {
    const key = 'all||||{}|addedAt:desc';
    setGallerySnapshot(key, {
      cards: [{ id: 'c1' } as GalleryScopeSnapshot['cards'][number]],
      srcMap: {},
      offset: 1,
      hasMore: false
    });
    expect(getGalleryCacheHit(key)?.cards).toHaveLength(1);
  });
});
