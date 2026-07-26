import { describe, expect, it } from 'vitest';

import { buildGalleryFilterStatsCacheKey } from '../galleryFilterStatsCache';

describe('buildGalleryFilterStatsCacheKey', () => {
  it('does not collide library feed (null moodboard) with empty moodboard ([])', () => {
    const library = buildGalleryFilterStatsCacheKey({
      libraryScope: 'all',
      moodboardCardIds: null
    });
    const emptyMoodboard = buildGalleryFilterStatsCacheKey({
      libraryScope: 'all',
      moodboardCardIds: []
    });
    expect(library).not.toBe(emptyMoodboard);
  });

  it('treats undefined moodboard like null (library feed)', () => {
    const a = buildGalleryFilterStatsCacheKey({ libraryScope: 'all' });
    const b = buildGalleryFilterStatsCacheKey({ libraryScope: 'all', moodboardCardIds: null });
    expect(a).toBe(b);
  });
});
