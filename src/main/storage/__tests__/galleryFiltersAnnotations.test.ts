import { describe, expect, it } from 'vitest';

import { emptyGalleryAdvancedFilters } from '../../shared/galleryFilterCore';
import { buildGalleryFilterWhere, type GalleryFilterQueryContext } from '../galleryFilters';

function context(
  annotations: GalleryFilterQueryContext['filters']['annotations']
): GalleryFilterQueryContext {
  return {
    libraryScope: 'all',
    filters: { ...emptyGalleryAdvancedFilters(), annotations },
    sort: { field: 'addedAt', direction: 'desc' }
  };
}

describe('buildGalleryFilterWhere — annotations', () => {
  it('adds no condition when unset', () => {
    const { wh } = buildGalleryFilterWhere(context(null));
    expect(wh.some((part) => part.includes('annotations_text'))).toBe(false);
  });

  it('matches missing annotations', () => {
    const { wh } = buildGalleryFilterWhere(context({ mode: 'missing' }));
    expect(wh).toContain(`(COALESCE(c.annotations_text, '') = '')`);
  });

  it('matches has + keywords via FTS', () => {
    const { wh, binds } = buildGalleryFilterWhere(context({ mode: 'has', keywords: 'cta button' }));
    expect(wh.some((part) => part.includes("annotations_text") && part.includes("!= ''"))).toBe(true);
    expect(wh.some((part) => part.includes('cards_fts'))).toBe(true);
    expect(binds.some((b) => typeof b === 'string' && b.includes('annotations_text'))).toBe(true);
  });
});
