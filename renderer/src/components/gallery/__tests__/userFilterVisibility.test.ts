import { describe, expect, it } from 'vitest';
import { createCustomTemplateField, createStarterTemplateField } from '@arc-main-shared/detailCardTemplate';
import { isUserFilterBarVisible, sanitizeUserFilterVisible } from '@arc-main-shared/galleryFilterCore';
import { defaultGalleryFilterLayout } from '../galleryFilterTypes';
import { setUserFilterVisibility } from '../galleryFilterLayout';
import { listedUserFilterFields } from '../userFilterFields';

describe('user filter bar visibility', () => {
  it('hides a chip without dropping the field from settings', () => {
    const layout = setUserFilterVisibility(defaultGalleryFilterLayout(), 'client', false);
    expect(isUserFilterBarVisible(layout, 'client')).toBe(false);
    expect(isUserFilterBarVisible(layout, 'other')).toBe(true);
  });

  it('shows the chip again after a second toggle', () => {
    const hidden = setUserFilterVisibility(defaultGalleryFilterLayout(), 'client', false);
    const shown = setUserFilterVisibility(hidden, 'client', true);
    expect(isUserFilterBarVisible(shown, 'client')).toBe(true);
  });

  it('keeps only boolean map entries from stored layout', () => {
    expect(sanitizeUserFilterVisible({ client: false, skip: true })).toEqual({
      client: false,
      skip: true
    });
    expect(sanitizeUserFilterVisible(null)).toBeUndefined();
  });
});

describe('listedUserFilterFields', () => {
  const template = {
    version: 1 as const,
    fields: [
      createStarterTemplateField('name'),
      { ...createCustomTemplateField('shortText', 'client'), showInFilters: true },
      { ...createCustomTemplateField('shortText', 'hidden'), showInFilters: false }
    ]
  };

  it('omits fields until at least one card has a value', () => {
    expect(listedUserFilterFields(template, undefined).map((field) => field.id)).toEqual([]);
    expect(listedUserFilterFields(template, { name: { has: 0, missing: 3 } }).map((field) => field.id)).toEqual([]);
  });

  it('adds a field after it is filled and ignores fields not shown in filters', () => {
    expect(
      listedUserFilterFields(template, {
        name: { has: 2, missing: 1 },
        client: { has: 1, missing: 2 },
        hidden: { has: 4, missing: 0 }
      }).map((field) => field.id)
    ).toEqual(['name', 'client']);
  });
});
