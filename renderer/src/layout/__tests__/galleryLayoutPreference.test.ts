import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GALLERY_LAYOUT_DEFAULT,
  GALLERY_LAYOUT_STORAGE_KEY,
  applyGalleryLayoutToDocument,
  isGalleryLayoutMode,
  readGalleryLayoutMode,
  writeGalleryLayoutMode
} from '../../layout/galleryLayoutPreference';
import { galleryCardDisplayName } from '../../components/gallery/galleryCardDisplayName';
import type { CardRecord } from '../../services/arcSchema';

describe('galleryLayoutPreference', () => {
  const store = new Map<string, string>();
  const bodyDataset: Record<string, string> = {};

  afterEach(() => {
    store.clear();
    for (const key of Object.keys(bodyDataset)) delete bodyDataset[key];
    vi.unstubAllGlobals();
  });

  function stubDom(dispatchEvent: () => boolean = () => true) {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        }
      },
      dispatchEvent
    });
    vi.stubGlobal('document', {
      body: {
        dataset: bodyDataset,
        removeAttribute: (name: string) => {
          if (name === 'data-gallery-layout') delete bodyDataset.galleryLayout;
        }
      }
    });
  }

  it('defaults to masonry', () => {
    stubDom();
    expect(readGalleryLayoutMode()).toBe(GALLERY_LAYOUT_DEFAULT);
  });

  it('validates known modes', () => {
    expect(isGalleryLayoutMode('masonry')).toBe(true);
    expect(isGalleryLayoutMode('grid')).toBe(true);
    expect(isGalleryLayoutMode('list')).toBe(true);
    expect(isGalleryLayoutMode('justified')).toBe(false);
  });

  it('persists and applies mode to document', () => {
    stubDom();
    writeGalleryLayoutMode('grid');
    expect(store.get(GALLERY_LAYOUT_STORAGE_KEY)).toBe('grid');
    expect(readGalleryLayoutMode()).toBe('grid');
    expect(bodyDataset.galleryLayout).toBe('grid');

    writeGalleryLayoutMode('list');
    expect(readGalleryLayoutMode()).toBe('list');
    expect(bodyDataset.galleryLayout).toBe('list');
  });

  it('applyGalleryLayoutToDocument sets body dataset', () => {
    stubDom();
    applyGalleryLayoutToDocument('masonry');
    expect(bodyDataset.galleryLayout).toBe('masonry');
  });

  it('does not notify listeners when the mode is already selected', () => {
    const dispatchEvent = vi.fn(() => true);
    stubDom(dispatchEvent);
    writeGalleryLayoutMode('grid');
    dispatchEvent.mockClear();
    writeGalleryLayoutMode('grid');
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});

describe('galleryCardDisplayName', () => {
  const base: CardRecord = {
    id: 'c1',
    type: 'image',
    addedAt: '2026-01-01T00:00:00.000Z',
    originalRelativePath: 'cards/c1/original.jpg',
    thumbRelativePath: 'cards/c1/thumb.jpg',
    tagIds: [],
    collectionIds: []
  };

  it('shows the library-relative original path', () => {
    expect(galleryCardDisplayName({ ...base, name: '  Portrait  ' })).toBe('cards/c1/original.jpg');
    expect(galleryCardDisplayName(base)).toBe('cards/c1/original.jpg');
  });

  it('falls back to card id when path is empty', () => {
    expect(galleryCardDisplayName({ ...base, originalRelativePath: '' })).toBe('c1');
    expect(galleryCardDisplayName({ ...base, originalRelativePath: '   ' })).toBe('c1');
  });
});
