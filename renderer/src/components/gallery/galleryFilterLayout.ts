import {
  GALLERY_FILTER_IDS,
  defaultGalleryFilterLayout,
  type GalleryFilterLayoutState,
  type GalleryFilterId
} from './galleryFilterTypes';

const STORAGE_KEY = 'arc.galleryFilterLayout.v1';

/** Сохранённая раскладка старше нового фильтра — добиваем недостающие id, иначе чип не появится. */
function withKnownFilterIds(layout: GalleryFilterLayoutState): GalleryFilterLayoutState {
  const order: GalleryFilterId[] = [];
  const visible = { ...defaultGalleryFilterLayout().visible };
  for (const id of layout.order) {
    if (!(GALLERY_FILTER_IDS as readonly string[]).includes(id)) continue;
    const gid = id as GalleryFilterId;
    if (order.includes(gid)) continue;
    order.push(gid);
  }
  for (const id of GALLERY_FILTER_IDS) {
    if (!order.includes(id)) order.push(id);
    if (id in layout.visible) visible[id] = layout.visible[id] !== false;
  }
  return { order, visible, userVisible: layout.userVisible };
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

/** Читает старую глобальную раскладку. Удалять ключ — только после успешной записи в библиотеку. */
export function consumeLegacyGalleryFilterLayout(): GalleryFilterLayoutState | null {
  const stored = readRaw();
  if (!stored) return null;
  return withKnownFilterIds(stored);
}

export function clearLegacyGalleryFilterLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
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

export function setUserFilterVisibility(
  layout: GalleryFilterLayoutState,
  fieldId: string,
  visible: boolean
): GalleryFilterLayoutState {
  return {
    ...layout,
    userVisible: { ...layout.userVisible, [fieldId]: visible }
  };
}
