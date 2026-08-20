import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GALLERY_FILTER_IDS,
  defaultGalleryFilterLayout,
  presetItemsToLayout
} from '../galleryFilterTypes';
import {
  clearLegacyGalleryFilterLayout,
  consumeLegacyGalleryFilterLayout
} from '../galleryFilterLayout';

const STORAGE_KEY = 'arc.galleryFilterLayout.v1';

describe('presetItemsToLayout', () => {
  it('keeps userVisible from the current library layout', () => {
    const current = {
      ...defaultGalleryFilterLayout(),
      userVisible: { client: false, project: true }
    };
    const items = GALLERY_FILTER_IDS.map((id) => ({
      id,
      visible: id !== 'rating'
    }));
    const next = presetItemsToLayout(items, current);
    expect(next.visible.rating).toBe(false);
    expect(next.visible.dateAdded).toBe(true);
    expect(next.userVisible).toEqual({ client: false, project: true });
  });

  it('omits userVisible when the current layout has none', () => {
    const next = presetItemsToLayout(
      [{ id: 'dateAdded', visible: true }],
      defaultGalleryFilterLayout()
    );
    expect(next.userVisible).toBeUndefined();
    expect(next.order).toHaveLength(GALLERY_FILTER_IDS.length);
    expect(new Set(next.order)).toEqual(new Set(GALLERY_FILTER_IDS));
    expect(next.order[0]).toBe('dateAdded');
  });
});

describe('consumeLegacyGalleryFilterLayout', () => {
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

  it('reads the legacy key without deleting it', () => {
    stubDom();
    const layout = defaultGalleryFilterLayout();
    store.set(STORAGE_KEY, JSON.stringify(layout));
    const consumed = consumeLegacyGalleryFilterLayout();
    expect(consumed?.order).toEqual(layout.order);
    expect(store.has(STORAGE_KEY)).toBe(true);
    clearLegacyGalleryFilterLayout();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
