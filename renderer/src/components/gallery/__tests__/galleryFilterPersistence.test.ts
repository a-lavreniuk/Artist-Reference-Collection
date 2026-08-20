import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters
} from '../galleryFilterTypes';
import {
  GALLERY_FILTERS_SORT_STORAGE_KEY,
  defaultGalleryFiltersSortTabState,
  isGalleryFilterPersistTab,
  readGalleryFiltersSortTab,
  writeGalleryFiltersSortTab
} from '../galleryFilterPersistence';

describe('galleryFilterPersistence', () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  function stubDom() {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    });
  }

  it('identifies persist tabs', () => {
    expect(isGalleryFilterPersistTab('gallery')).toBe(true);
    expect(isGalleryFilterPersistTab('collections')).toBe(true);
    expect(isGalleryFilterPersistTab('moodboard')).toBe(true);
    expect(isGalleryFilterPersistTab('board')).toBe(false);
  });

  it('defaults to empty filters and default sort', () => {
    stubDom();
    expect(readGalleryFiltersSortTab('gallery')).toEqual(defaultGalleryFiltersSortTabState());
    expect(readGalleryFiltersSortTab('gallery').sort).toEqual(DEFAULT_GALLERY_SORT);
    expect(readGalleryFiltersSortTab('gallery').filters).toEqual(emptyGalleryAdvancedFilters());
  });

  it('persists independent snapshots per tab', () => {
    stubDom();
    const galleryFilters = {
      ...emptyGalleryAdvancedFilters(),
      fileExtensions: ['JPG']
    };
    const collectionsSort = { field: 'fileWeight' as const, direction: 'asc' as const };

    writeGalleryFiltersSortTab('gallery', {
      filters: galleryFilters,
      sort: { ...DEFAULT_GALLERY_SORT }
    });
    writeGalleryFiltersSortTab('collections', {
      filters: emptyGalleryAdvancedFilters(),
      sort: collectionsSort
    });

    expect(readGalleryFiltersSortTab('gallery').filters.fileExtensions).toEqual(['JPG']);
    expect(readGalleryFiltersSortTab('collections').filters.fileExtensions).toEqual([]);
    expect(readGalleryFiltersSortTab('collections').sort).toEqual(collectionsSort);
    expect(readGalleryFiltersSortTab('moodboard').filters.fileExtensions).toEqual([]);

    const raw = store.get(GALLERY_FILTERS_SORT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { version: number; byTab: Record<string, unknown> };
    expect(parsed.version).toBe(1);
    expect(parsed.byTab.gallery).toBeTruthy();
    expect(parsed.byTab.collections).toBeTruthy();
    expect(parsed.byTab.moodboard).toBeUndefined();
  });

  it('survives clear of one tab without wiping others', () => {
    stubDom();
    writeGalleryFiltersSortTab('gallery', {
      filters: { ...emptyGalleryAdvancedFilters(), aspectRatios: ['horizontal'] },
      sort: { field: 'shuffle', direction: 'asc' }
    });
    writeGalleryFiltersSortTab('moodboard', {
      filters: { ...emptyGalleryAdvancedFilters(), custom: { link: { mode: 'has' } } },
      sort: { ...DEFAULT_GALLERY_SORT }
    });

    writeGalleryFiltersSortTab('gallery', defaultGalleryFiltersSortTabState());

    expect(readGalleryFiltersSortTab('gallery').filters.aspectRatios).toEqual([]);
    expect(readGalleryFiltersSortTab('gallery').sort.field).toBe('addedAt');
    expect(readGalleryFiltersSortTab('moodboard').filters.custom.link).toEqual({ mode: 'has' });
  });

  it('ignores corrupt storage', () => {
    stubDom();
    store.set(GALLERY_FILTERS_SORT_STORAGE_KEY, '{not-json');
    expect(readGalleryFiltersSortTab('gallery')).toEqual(defaultGalleryFiltersSortTabState());

    store.set(GALLERY_FILTERS_SORT_STORAGE_KEY, JSON.stringify({ version: 99, byTab: {} }));
    expect(readGalleryFiltersSortTab('collections')).toEqual(defaultGalleryFiltersSortTabState());
  });

  it('keeps custom sort field', () => {
    stubDom();
    writeGalleryFiltersSortTab('gallery', {
      filters: emptyGalleryAdvancedFilters(),
      sort: { field: 'custom:client', direction: 'asc' }
    });
    expect(readGalleryFiltersSortTab('gallery').sort).toEqual({
      field: 'custom:client',
      direction: 'asc'
    });
  });

  it('keeps custom dateAdded ranges', () => {
    stubDom();
    const filters = {
      ...emptyGalleryAdvancedFilters(),
      dateAdded: [{ preset: 'custom' as const, from: '2026-01-01', to: '2026-01-31' }]
    };
    writeGalleryFiltersSortTab('gallery', { filters, sort: { ...DEFAULT_GALLERY_SORT } });
    expect(readGalleryFiltersSortTab('gallery').filters.dateAdded).toEqual(filters.dateAdded);
  });
});
