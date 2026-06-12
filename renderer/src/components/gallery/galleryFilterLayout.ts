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

export function reorderFilterInLayout(
  layout: GalleryFilterLayoutState,
  id: GalleryFilterId,
  insertIndex: number
): GalleryFilterLayoutState {
  const order = [...layout.order];
  const fromIndex = order.indexOf(id);
  if (fromIndex < 0) return layout;
  const bounded = Math.max(0, Math.min(insertIndex, order.length));
  order.splice(fromIndex, 1);
  let target = bounded;
  if (fromIndex < bounded) target -= 1;
  order.splice(target, 0, id);
  return { ...layout, order };
}

export function setFilterVisibility(
  layout: GalleryFilterLayoutState,
  id: GalleryFilterId,
  visible: boolean
): GalleryFilterLayoutState {
  return { ...layout, visible: { ...layout.visible, [id]: visible } };
}
