import { describe, expect, it } from 'vitest';

import { emptyGalleryAdvancedFilters } from '../../shared/galleryFilterCore';
import { buildGalleryFilterWhere, type GalleryFilterQueryContext } from '../galleryFilters';

function context(
  description: GalleryFilterQueryContext['filters']['description']
): GalleryFilterQueryContext {
  return {
    libraryScope: 'all',
    filters: { ...emptyGalleryAdvancedFilters(), description },
    sort: { field: 'addedAt', direction: 'desc' }
  };
}

describe('buildGalleryFilterWhere — description keywords include custom fields', () => {
  it('keeps missing mode on description column only', () => {
    const { wh } = buildGalleryFilterWhere(context({ mode: 'missing' }));
    expect(wh).toContain(`(COALESCE(c.description, '') = '')`);
    expect(wh.some((part) => part.includes('custom_fields_text'))).toBe(false);
  });

  it('matches has + keywords on description or custom_fields_text', () => {
    const { wh, binds } = buildGalleryFilterWhere(context({ mode: 'has', keywords: 'клиент' }));
    expect(wh.some((part) => part.includes("description") && part.includes("!= ''"))).toBe(true);
    expect(wh.some((part) => part.includes('cards_fts'))).toBe(true);
    expect(binds.some((b) => typeof b === 'string' && b.includes('custom_fields_text'))).toBe(true);
    expect(binds.some((b) => typeof b === 'string' && b.includes('description'))).toBe(true);
  });
});
