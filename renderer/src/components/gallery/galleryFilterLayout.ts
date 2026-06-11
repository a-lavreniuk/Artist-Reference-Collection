import {
  defaultGalleryFilterLayout,
  type GalleryFilterLayoutState,
  type GalleryFilterId
} from './galleryFilterTypes';

const STORAGE_KEY = 'arc.galleryFilterLayout.v1';

function readRaw(): GalleryFilterLayoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GalleryFilterLayoutState;
    if (!Array.isArray(parsed.order) || !parsed.visible) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readGalleryFilterLayout(): GalleryFilterLayoutState {
  return readRaw() ?? defaultGalleryFilterLayout();
}

export function writeGalleryFilterLayout(layout: GalleryFilterLayoutState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function moveFilterInLayout(
  layout: GalleryFilterLayoutState,
  id: GalleryFilterId,
  direction: 'up' | 'down'
): GalleryFilterLayoutState {
  const order = [...layout.order];
  const idx = order.indexOf(id);
  if (idx < 0) return layout;
  const swap = direction === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= order.length) return layout;
  [order[idx], order[swap]] = [order[swap], order[idx]];
  return { ...layout, order };
}

export function setFilterVisibility(
  layout: GalleryFilterLayoutState,
  id: GalleryFilterId,
  visible: boolean
): GalleryFilterLayoutState {
  return { ...layout, visible: { ...layout.visible, [id]: visible } };
}
