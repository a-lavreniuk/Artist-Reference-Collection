import { describe, expect, it } from 'vitest';
import {
  emptyGalleryAdvancedFilters,
  pruneCustomFiltersMissingFromTemplate
} from '../galleryFilterCore';

describe('pruneCustomFiltersMissingFromTemplate', () => {
  it('keeps a custom filter when the field is still in the template', () => {
    const filters = {
      ...emptyGalleryAdvancedFilters(),
      custom: { client: { mode: 'has' as const } }
    };
    const next = pruneCustomFiltersMissingFromTemplate(filters, ['client', 'description']);
    expect(next).toBe(filters);
    expect(next.custom.client).toEqual({ mode: 'has' });
  });

  it('does not drop a filter just because the current selection has zero filled values', () => {
    const filters = {
      ...emptyGalleryAdvancedFilters(),
      custom: {
        client: { mode: 'has' as const },
        emptyDate: { ranges: [{ preset: 'today' as const }] }
      }
    };
    const next = pruneCustomFiltersMissingFromTemplate(filters, ['client', 'emptyDate']);
    expect(next.custom).toEqual(filters.custom);
  });

  it('removes only filters whose fields are gone from the template', () => {
    const filters = {
      ...emptyGalleryAdvancedFilters(),
      custom: {
        client: { mode: 'has' as const },
        removed: { mode: 'missing' as const }
      }
    };
    const next = pruneCustomFiltersMissingFromTemplate(filters, ['client']);
    expect(next).not.toBe(filters);
    expect(next.custom).toEqual({ client: { mode: 'has' } });
    expect(next.custom.removed).toBeUndefined();
  });
});
