import { describe, expect, it } from 'vitest';

import { emptyGalleryAdvancedFilters, migrateGalleryAdvancedFiltersShape } from '../../shared/galleryFilterCore';
import { createStarterTemplateField, createCustomTemplateField } from '../../shared/detailCardTemplate';
import { buildGalleryFilterWhere, buildGallerySortSql, type GalleryFilterQueryContext } from '../galleryFilters';

function context(overrides: Partial<GalleryFilterQueryContext> = {}): GalleryFilterQueryContext {
  return {
    libraryScope: 'all',
    filters: emptyGalleryAdvancedFilters(),
    sort: { field: 'addedAt', direction: 'desc' },
    template: {
      version: 1,
      fields: [
        createStarterTemplateField('name'),
        createStarterTemplateField('link'),
        createStarterTemplateField('description'),
        createCustomTemplateField('shortText', 'client')
      ]
    },
    ...overrides
  };
}

describe('buildGalleryFilterWhere — custom fields', () => {
  it('filters starter description by column, not FTS custom_fields_text', () => {
    const { wh, binds } = buildGalleryFilterWhere(
      context({
        filters: {
          ...emptyGalleryAdvancedFilters(),
          custom: { description: { mode: 'has', keywords: 'клиент' } }
        }
      })
    );
    expect(wh.some((part) => part.includes('c.description') && part.includes("!= ''"))).toBe(true);
    expect(wh.some((part) => part.includes('custom_fields_text'))).toBe(false);
    expect(binds.some((b) => typeof b === 'string' && b.includes('клиент'))).toBe(true);
  });

  it('filters a json custom field by json_extract', () => {
    const { wh } = buildGalleryFilterWhere(
      context({
        filters: {
          ...emptyGalleryAdvancedFilters(),
          custom: { client: { mode: 'has', keywords: 'acme' } }
        }
      })
    );
    expect(wh.some((part) => part.includes("json_extract(c.custom_fields_json, '$.client')"))).toBe(true);
    expect(wh.some((part) => part.includes('custom_fields_text'))).toBe(false);
  });

  it('keeps missing mode on the starter description column', () => {
    const { wh } = buildGalleryFilterWhere(
      context({
        filters: {
          ...emptyGalleryAdvancedFilters(),
          custom: { description: { mode: 'missing' } }
        }
      })
    );
    expect(wh.some((part) => part.includes('c.description'))).toBe(true);
    expect(wh.some((part) => part.includes('custom_fields_text'))).toBe(false);
  });
});

describe('buildGallerySortSql — custom fields', () => {
  it('sorts starter name by column', () => {
    const sql = buildGallerySortSql(
      { field: 'custom:name', direction: 'asc' },
      'c',
      context().template
    );
    expect(sql).toContain("COALESCE(c.name, '')");
    expect(sql).toContain('COLLATE NOCASE');
  });
});

describe('migrateGalleryAdvancedFiltersShape', () => {
  it('moves legacy description and link into custom', () => {
    const next = migrateGalleryAdvancedFiltersShape({
      ...emptyGalleryAdvancedFilters(),
      description: { mode: 'has', keywords: 'бренд' },
      link: { mode: 'missing' }
    } as unknown);
    expect(next.custom.description).toEqual({ mode: 'has', keywords: 'бренд' });
    expect(next.custom.link).toEqual({ mode: 'missing' });
    expect('description' in next).toBe(false);
    expect('link' in next).toBe(false);
  });
});
