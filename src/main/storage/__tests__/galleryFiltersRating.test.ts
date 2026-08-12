import { describe, expect, it } from 'vitest';

import { clampCardRating, normalizeCardRating } from '../../shared/cardRating';
import { emptyGalleryAdvancedFilters } from '../../shared/galleryFilterCore';
import { buildGalleryFilterWhere, buildGallerySortSql } from '../galleryFilters';
import type { GalleryFilterQueryContext } from '../galleryFilters';

function context(rating: GalleryFilterQueryContext['filters']['rating']): GalleryFilterQueryContext {
  return {
    libraryScope: 'all',
    filters: { ...emptyGalleryAdvancedFilters(), rating },
    sort: { field: 'addedAt', direction: 'desc' }
  };
}

describe('clampCardRating', () => {
  it('keeps integers inside 0..5', () => {
    expect(clampCardRating(3)).toBe(3);
    expect(clampCardRating(0)).toBe(0);
    expect(clampCardRating(5)).toBe(5);
  });

  it('clamps out-of-range and rounds fractions', () => {
    expect(clampCardRating(-2)).toBe(0);
    expect(clampCardRating(9)).toBe(5);
    expect(clampCardRating(2.4)).toBe(2);
    expect(clampCardRating(2.6)).toBe(3);
  });

  it('falls back to 0 for junk values', () => {
    expect(clampCardRating(undefined)).toBe(0);
    expect(clampCardRating(null)).toBe(0);
    expect(clampCardRating('abc')).toBe(0);
    expect(clampCardRating(Number.NaN)).toBe(0);
  });

  it('normalizeCardRating drops empty rating', () => {
    expect(normalizeCardRating(0)).toBeUndefined();
    expect(normalizeCardRating(null)).toBeUndefined();
    expect(normalizeCardRating(4)).toBe(4);
  });
});

describe('buildGalleryFilterWhere — rating', () => {
  it('adds no rating condition when nothing selected', () => {
    const { wh, binds } = buildGalleryFilterWhere(context([]));
    expect(wh.some((part) => part.includes('rating'))).toBe(false);
    expect(binds).toHaveLength(0);
  });

  it('matches selected values, including «без оценки»', () => {
    const { wh, binds } = buildGalleryFilterWhere(context([{ value: 0 }, { value: 5 }]));
    expect(wh).toContain('COALESCE(c.rating, 0) IN (?,?)');
    expect(binds).toEqual([0, 5]);
  });

  it('deduplicates repeated values', () => {
    const { binds } = buildGalleryFilterWhere(context([{ value: 3 }, { value: 3 }]));
    expect(binds).toEqual([3]);
  });
});

describe('buildGallerySortSql — rating', () => {
  it('sorts by rating with added_at tiebreaker', () => {
    expect(buildGallerySortSql({ field: 'rating', direction: 'desc' })).toBe(
      'ORDER BY COALESCE(c.rating, 0) DESC, c.added_at DESC'
    );
    expect(buildGallerySortSql({ field: 'rating', direction: 'asc' })).toBe(
      'ORDER BY COALESCE(c.rating, 0) ASC, c.added_at DESC'
    );
  });
});
