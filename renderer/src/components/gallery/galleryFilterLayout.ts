import {
  GALLERY_FILTER_IDS,
  defaultGalleryFilterLayout,
  type GalleryFilterLayoutState,
  type GalleryFilterId
} from './galleryFilterTypes';

const STORAGE_KEY = 'arc.galleryFilterLayout.v1';

/** Сохранённая раскладка старше нового фильтра — добиваем недостающие id, иначе чип не появится. */
function withKnownFilterIds(layout: GalleryFilterLayoutState): GalleryFilterLayoutState {
  const order = [...layout.order];
  const visible = { ...layout.visible };
  for (const id of GALLERY_FILTER_IDS) {
    if (!order.includes(id)) order.push(id);
    if (!(id in visible)) visible[id] = true;
  }
  return { order, visible };
}

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
  const stored = readRaw();
  return stored ? withKnownFilterIds(stored) : defaultGalleryFilterLayout();
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
