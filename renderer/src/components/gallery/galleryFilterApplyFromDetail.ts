import {
  readGalleryFiltersSortTab,
  writeGalleryFiltersSortTab,
  type GalleryFilterPersistTab
} from './galleryFilterPersistence';
import type { GalleryAdvancedFilters } from './galleryFilterTypes';

export const GALLERY_FILTERS_RELOAD_EVENT = 'arc:gallery-filters-reload';

export function applyGalleryTabFilterPatch(
  tab: GalleryFilterPersistTab,
  patch: Partial<GalleryAdvancedFilters>
) {
  const current = readGalleryFiltersSortTab(tab);
  writeGalleryFiltersSortTab(tab, {
    ...current,
    filters: { ...current.filters, ...patch }
  });
  window.dispatchEvent(new CustomEvent(GALLERY_FILTERS_RELOAD_EVENT));
}
