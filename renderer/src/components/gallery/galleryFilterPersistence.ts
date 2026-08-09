import type { MainTabKey } from '../layout/navbarLayout';
import {
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  migrateGalleryAdvancedFilters,
  type GalleryAdvancedFilters,
  type GallerySortState
} from './galleryFilterTypes';

export const GALLERY_FILTERS_SORT_STORAGE_KEY = 'arc.galleryFiltersSort.v1';

/** Tabs that keep an independent filters+sort snapshot (model B). */
export type GalleryFilterPersistTab = 'gallery' | 'collections' | 'moodboard';

export type GalleryFiltersSortTabState = {
  filters: GalleryAdvancedFilters;
  sort: GallerySortState;
};

type GalleryFiltersSortStore = {
  version: 1;
  byTab: Partial<Record<GalleryFilterPersistTab, GalleryFiltersSortTabState>>;
};

const PERSIST_TABS: readonly GalleryFilterPersistTab[] = ['gallery', 'collections', 'moodboard'];

export function isGalleryFilterPersistTab(tab: MainTabKey): tab is GalleryFilterPersistTab {
  return (PERSIST_TABS as readonly string[]).includes(tab);
}

export function defaultGalleryFiltersSortTabState(): GalleryFiltersSortTabState {
  return {
    filters: emptyGalleryAdvancedFilters(),
    sort: { ...DEFAULT_GALLERY_SORT }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSort(raw: unknown): GallerySortState {
  if (!isRecord(raw)) return { ...DEFAULT_GALLERY_SORT };
  const field = raw.field;
  const direction = raw.direction;
  const knownFields = new Set(['addedAt', 'fileType', 'fileWeight', 'resolution', 'duration', 'shuffle']);
  if (typeof field !== 'string' || !knownFields.has(field)) return { ...DEFAULT_GALLERY_SORT };
  if (direction !== 'asc' && direction !== 'desc') return { ...DEFAULT_GALLERY_SORT };
  const sort: GallerySortState = {
    field: field as GallerySortState['field'],
    direction
  };
  if (typeof raw.shuffleSeed === 'number' && Number.isFinite(raw.shuffleSeed)) {
    sort.shuffleSeed = raw.shuffleSeed;
  }
  return sort;
}

function normalizeTabState(raw: unknown): GalleryFiltersSortTabState | null {
  if (!isRecord(raw)) return null;
  if (!isRecord(raw.filters)) return null;
  try {
    return {
      filters: migrateGalleryAdvancedFilters(raw.filters as GalleryAdvancedFilters),
      sort: normalizeSort(raw.sort)
    };
  } catch {
    return null;
  }
}

function readStore(): GalleryFiltersSortStore {
  try {
    const raw = localStorage.getItem(GALLERY_FILTERS_SORT_STORAGE_KEY);
    if (!raw) return { version: 1, byTab: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.byTab)) {
      return { version: 1, byTab: {} };
    }
    const byTab: GalleryFiltersSortStore['byTab'] = {};
    for (const tab of PERSIST_TABS) {
      const slot = normalizeTabState(parsed.byTab[tab]);
      if (slot) byTab[tab] = slot;
    }
    return { version: 1, byTab };
  } catch {
    return { version: 1, byTab: {} };
  }
}

function writeStore(store: GalleryFiltersSortStore): void {
  localStorage.setItem(GALLERY_FILTERS_SORT_STORAGE_KEY, JSON.stringify(store));
}

export function readGalleryFiltersSortTab(tab: GalleryFilterPersistTab): GalleryFiltersSortTabState {
  const store = readStore();
  return store.byTab[tab] ?? defaultGalleryFiltersSortTabState();
}

export function writeGalleryFiltersSortTab(
  tab: GalleryFilterPersistTab,
  state: GalleryFiltersSortTabState
): void {
  const store = readStore();
  store.byTab[tab] = {
    filters: migrateGalleryAdvancedFilters(state.filters),
    sort: normalizeSort(state.sort)
  };
  writeStore(store);
}
