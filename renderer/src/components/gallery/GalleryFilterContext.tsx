import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import { useLocation } from 'react-router-dom';
import { resolveMainTab } from '../layout/navbarLayout';
import {
  reorderFilterInLayout,
  readGalleryFilterLayout,
  setFilterVisibility,
  writeGalleryFilterLayout
} from './galleryFilterLayout';
import {
  defaultGalleryFiltersSortTabState,
  isGalleryFilterPersistTab,
  readGalleryFiltersSortTab,
  writeGalleryFiltersSortTab,
  type GalleryFilterPersistTab
} from './galleryFilterPersistence';
import {
  countActiveFilterCategories,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  layoutToPresetItems,
  migrateGalleryAdvancedFilters,
  presetItemsToLayout,
  type DurationFilterValue,
  type GalleryAdvancedFilters,
  type GalleryFeedScope,
  type GalleryFilterId,
  type GalleryFilterLayoutState,
  type GalleryFilterPresetPayload,
  type GalleryFilterStats,
  type GallerySortState,
  type SavedFilterPreset
} from './galleryFilterTypes';
import * as storage from '../../services/storageClient';

type PatchFiltersOptions = {
  /** When false, live state updates but localStorage for the tab is left alone. */
  persist?: boolean;
};

type GalleryFilterContextValue = {
  filters: GalleryAdvancedFilters;
  setFilters: (next: GalleryAdvancedFilters) => void;
  patchFilters: (patch: Partial<GalleryAdvancedFilters>, options?: PatchFiltersOptions) => void;
  clearFilters: () => void;
  clearFilterCategory: (id: GalleryFilterId) => void;
  sort: GallerySortState;
  setSort: (next: GallerySortState) => void;
  layout: GalleryFilterLayoutState;
  setLayout: (next: GalleryFilterLayoutState) => void;
  reorderFilter: (id: GalleryFilterId, toIndex: number) => void;
  toggleFilterVisibility: (id: GalleryFilterId) => void;
  feedScope: GalleryFeedScope;
  setFeedScope: Dispatch<SetStateAction<GalleryFeedScope>>;
  stats: GalleryFilterStats | null;
  refreshStats: () => Promise<void>;
  presets: SavedFilterPreset[];
  refreshPresets: () => Promise<void>;
  savePreset: (name: string) => Promise<void>;
  applyPreset: (preset: SavedFilterPreset) => void;
  deletePreset: (id: string) => Promise<void>;
  renamePreset: (id: string, name: string) => Promise<void>;
  activeCategoryCount: number;
  shuffleReloading: boolean;
  setShuffleReloading: (value: boolean) => void;
};

const GalleryFilterContext = createContext<GalleryFilterContextValue | null>(null);

function initialTabState(pathname: string) {
  const tab = resolveMainTab(pathname);
  if (isGalleryFilterPersistTab(tab)) return readGalleryFiltersSortTab(tab);
  return defaultGalleryFiltersSortTabState();
}

export function GalleryFilterProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const mainTabRef = useRef(resolveMainTab(location.pathname));

  const [filters, setFiltersState] = useState<GalleryAdvancedFilters>(
    () => initialTabState(location.pathname).filters
  );
  const [sort, setSortState] = useState<GallerySortState>(
    () => initialTabState(location.pathname).sort
  );
  const [layout, setLayoutState] = useState<GalleryFilterLayoutState>(() => readGalleryFilterLayout());
  const [feedScope, setFeedScope] = useState<GalleryFeedScope>({ libraryScope: 'all' });
  const [stats, setStats] = useState<GalleryFilterStats | null>(null);
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [shuffleReloading, setShuffleReloading] = useState(false);

  const filtersRef = useRef(filters);
  const sortRef = useRef(sort);
  const statsRef = useRef(stats);
  /** Values hidden by auto-clear; kept so persistence / restore are not wiped. */
  const suppressedDurationRef = useRef<DurationFilterValue[] | null>(null);
  const suppressedFileExtensionsRef = useRef<string[] | null>(null);
  filtersRef.current = filters;
  sortRef.current = sort;
  statsRef.current = stats;

  const filtersForPersist = useCallback((nextFilters: GalleryAdvancedFilters): GalleryAdvancedFilters => {
    let out = nextFilters;
    if (out.duration.length === 0) {
      const suppressed = suppressedDurationRef.current;
      if (suppressed && suppressed.length > 0) {
        out = { ...out, duration: suppressed };
      }
    }
    if (out.fileExtensions.length === 0) {
      const suppressed = suppressedFileExtensionsRef.current;
      if (suppressed && suppressed.length > 0) {
        out = { ...out, fileExtensions: suppressed };
      }
    }
    return out;
  }, []);

  const persistTabState = useCallback(
    (tab: GalleryFilterPersistTab, nextFilters: GalleryAdvancedFilters, nextSort: GallerySortState) => {
      writeGalleryFiltersSortTab(tab, {
        filters: filtersForPersist(nextFilters),
        sort: nextSort
      });
    },
    [filtersForPersist]
  );

  const setLayout = useCallback((next: GalleryFilterLayoutState) => {
    setLayoutState(next);
    writeGalleryFilterLayout(next);
  }, []);

  const setFilters = useCallback(
    (next: GalleryAdvancedFilters) => {
      const migrated = migrateGalleryAdvancedFilters(next);
      suppressedDurationRef.current = null;
      suppressedFileExtensionsRef.current = null;
      filtersRef.current = migrated;
      setFiltersState(migrated);
      const tab = mainTabRef.current;
      if (isGalleryFilterPersistTab(tab)) persistTabState(tab, migrated, sortRef.current);
    },
    [persistTabState]
  );

  const setSort = useCallback(
    (next: GallerySortState) => {
      sortRef.current = next;
      setSortState(next);
      const tab = mainTabRef.current;
      if (isGalleryFilterPersistTab(tab)) persistTabState(tab, filtersRef.current, next);
    },
    [persistTabState]
  );

  const patchFilters = useCallback(
    (patch: Partial<GalleryAdvancedFilters>, options?: PatchFiltersOptions) => {
      const persist = options?.persist !== false;
      if (persist && 'duration' in patch) {
        suppressedDurationRef.current = null;
      }
      if (persist && 'fileExtensions' in patch) {
        suppressedFileExtensionsRef.current = null;
      }
      setFiltersState((prev) => {
        const next = { ...prev, ...patch };
        filtersRef.current = next;
        if (persist) {
          const tab = mainTabRef.current;
          if (isGalleryFilterPersistTab(tab)) persistTabState(tab, next, sortRef.current);
        }
        return next;
      });
    },
    [persistTabState]
  );

  const clearFilters = useCallback(() => {
    const empty = emptyGalleryAdvancedFilters();
    const defaultSort = { ...DEFAULT_GALLERY_SORT };
    suppressedDurationRef.current = null;
    suppressedFileExtensionsRef.current = null;
    filtersRef.current = empty;
    sortRef.current = defaultSort;
    setFiltersState(empty);
    setSortState(defaultSort);
    const tab = mainTabRef.current;
    if (isGalleryFilterPersistTab(tab)) {
      writeGalleryFiltersSortTab(tab, { filters: empty, sort: defaultSort });
    }
  }, []);

  const clearFilterCategory = useCallback(
    (id: GalleryFilterId) => {
      switch (id) {
        case 'aspectRatio':
          patchFilters({ aspectRatios: [] });
          break;
        case 'fileType':
          patchFilters({ fileExtensions: [] });
          break;
        case 'tagPresence':
          patchFilters({ tagPresence: null });
          break;
        case 'description':
          patchFilters({ description: null });
          break;
        case 'link':
          patchFilters({ link: null });
          break;
        case 'dateAdded':
          patchFilters({ dateAdded: [] });
          break;
        case 'fileWeight':
          patchFilters({ fileWeight: [] });
          break;
        case 'resolution':
          patchFilters({ resolution: [] });
          break;
        case 'duration':
          patchFilters({ duration: [] });
          break;
        case 'rating':
          patchFilters({ rating: [] });
          break;
        default:
          break;
      }
    },
    [patchFilters]
  );

  const reorderFilter = useCallback(
    (id: GalleryFilterId, toIndex: number) => {
      setLayout(reorderFilterInLayout(layout, id, toIndex));
    },
    [layout, setLayout]
  );

  const toggleFilterVisibility = useCallback(
    (id: GalleryFilterId) => {
      setLayout(setFilterVisibility(layout, id, !layout.visible[id]));
    },
    [layout, setLayout]
  );

  useLayoutEffect(() => {
    const nextTab = resolveMainTab(location.pathname);
    const prevTab = mainTabRef.current;
    if (nextTab === prevTab) return;

    if (isGalleryFilterPersistTab(prevTab)) {
      persistTabState(prevTab, filtersRef.current, sortRef.current);
    }

    mainTabRef.current = nextTab;

    if (isGalleryFilterPersistTab(nextTab)) {
      suppressedDurationRef.current = null;
      suppressedFileExtensionsRef.current = null;
      const loaded = readGalleryFiltersSortTab(nextTab);
      filtersRef.current = loaded.filters;
      sortRef.current = loaded.sort;
      setFiltersState(loaded.filters);
      setSortState(loaded.sort);
    }
  }, [location.pathname, persistTabState]);

  const refreshStats = useCallback(async () => {
    try {
      const data = await storage.storageGalleryFilterStats({
        libraryScope: feedScope.libraryScope,
        selectedTagIds: feedScope.selectedTagIds,
        cardIdExact: feedScope.cardIdExact,
        collectionId: feedScope.collectionId,
        moodboardCardIds: feedScope.moodboardCardIds
      });
      setStats(data);
    } catch {
      setStats(null);
    }
  }, [feedScope]);

  const refreshPresets = useCallback(async () => {
    try {
      const rows = await storage.storageListFilterPresets();
      setPresets(rows);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    if (!stats || stats.hasVideo || filters.duration.length === 0) return;
    suppressedDurationRef.current = filters.duration;
    patchFilters({ duration: [] }, { persist: false });
  }, [stats, filters.duration.length, patchFilters]);

  // Restore duration once video appears again in this feed.
  useEffect(() => {
    if (!stats?.hasVideo || filters.duration.length > 0) return;
    const suppressed = suppressedDurationRef.current;
    if (suppressed && suppressed.length > 0) {
      suppressedDurationRef.current = null;
      patchFilters({ duration: suppressed }, { persist: false });
      return;
    }
    const tab = mainTabRef.current;
    if (!isGalleryFilterPersistTab(tab)) return;
    const stored = readGalleryFiltersSortTab(tab);
    if (stored.filters.duration.length === 0) return;
    patchFilters({ duration: stored.filters.duration }, { persist: false });
  }, [stats?.hasVideo, filters.duration.length, patchFilters]);

  useEffect(() => {
    if (!stats || filters.fileExtensions.length === 0) return;
    const anyExtStillPresent = filters.fileExtensions.some(
      (ext) => (stats.fileExtensions[ext] ?? 0) > 0
    );
    if (!anyExtStillPresent) {
      suppressedFileExtensionsRef.current = filters.fileExtensions;
      patchFilters({ fileExtensions: [] }, { persist: false });
    }
  }, [stats, filters.fileExtensions, patchFilters]);

  // Restore file type filters once matching extensions reappear in stats.
  useEffect(() => {
    if (!stats || filters.fileExtensions.length > 0) return;
    const candidates =
      suppressedFileExtensionsRef.current ??
      (isGalleryFilterPersistTab(mainTabRef.current)
        ? readGalleryFiltersSortTab(mainTabRef.current).filters.fileExtensions
        : []);
    if (candidates.length === 0) return;
    const restored = candidates.filter((ext) => (stats.fileExtensions[ext] ?? 0) > 0);
    if (restored.length === 0) return;
    suppressedFileExtensionsRef.current = null;
    patchFilters({ fileExtensions: restored }, { persist: false });
  }, [stats, filters.fileExtensions.length, patchFilters]);

  useEffect(() => {
    const onLibrary = () => {
      void refreshStats();
      void refreshPresets();
    };
    window.addEventListener('arc:library-changed', onLibrary);
    return () => window.removeEventListener('arc:library-changed', onLibrary);
  }, [refreshPresets, refreshStats]);

  const buildPresetPayload = useCallback((): GalleryFilterPresetPayload => {
    return {
      version: 1,
      filters,
      sort,
      layout: layoutToPresetItems(layout)
    };
  }, [filters, layout, sort]);

  const savePreset = useCallback(
    async (name: string) => {
      const id = crypto.randomUUID();
      const payload = buildPresetPayload();
      await storage.storageUpsertFilterPreset(id, name, payload);
      await refreshPresets();
    },
    [buildPresetPayload, refreshPresets]
  );

  const applyPreset = useCallback(
    (preset: SavedFilterPreset) => {
      const nextFilters = migrateGalleryAdvancedFilters(preset.payload.filters);
      const nextSort = preset.payload.sort;
      suppressedDurationRef.current = null;
      suppressedFileExtensionsRef.current = null;
      filtersRef.current = nextFilters;
      sortRef.current = nextSort;
      setFiltersState(nextFilters);
      setSortState(nextSort);
      const tab = mainTabRef.current;
      if (isGalleryFilterPersistTab(tab)) {
        persistTabState(tab, nextFilters, nextSort);
      }
      const nextLayout = presetItemsToLayout(preset.payload.layout);
      setLayout(nextLayout);
    },
    [persistTabState, setLayout]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      await storage.storageDeleteFilterPreset(id);
      await refreshPresets();
    },
    [refreshPresets]
  );

  const renamePreset = useCallback(
    async (id: string, name: string) => {
      await storage.storageRenameFilterPreset(id, name);
      await refreshPresets();
    },
    [refreshPresets]
  );

  const activeCategoryCount = useMemo(() => countActiveFilterCategories(filters), [filters]);

  const value = useMemo<GalleryFilterContextValue>(
    () => ({
      filters,
      setFilters,
      patchFilters,
      clearFilters,
      clearFilterCategory,
      sort,
      setSort,
      layout,
      setLayout,
      reorderFilter,
      toggleFilterVisibility,
      feedScope,
      setFeedScope,
      stats,
      refreshStats,
      presets,
      refreshPresets,
      savePreset,
      applyPreset,
      deletePreset,
      renamePreset,
      activeCategoryCount,
      shuffleReloading,
      setShuffleReloading
    }),
    [
      filters,
      setFilters,
      patchFilters,
      clearFilters,
      clearFilterCategory,
      sort,
      setSort,
      layout,
      setLayout,
      reorderFilter,
      toggleFilterVisibility,
      feedScope,
      stats,
      refreshStats,
      presets,
      refreshPresets,
      savePreset,
      applyPreset,
      deletePreset,
      renamePreset,
      activeCategoryCount,
      shuffleReloading
    ]
  );

  return <GalleryFilterContext.Provider value={value}>{children}</GalleryFilterContext.Provider>;
}

export function useGalleryFilters(): GalleryFilterContextValue {
  const ctx = useContext(GalleryFilterContext);
  if (!ctx) throw new Error('useGalleryFilters вне GalleryFilterProvider');
  return ctx;
}

function feedScopeKey(scope: GalleryFeedScope): string {
  return JSON.stringify({
    libraryScope: scope.libraryScope ?? 'all',
    selectedTagIds: [...(scope.selectedTagIds ?? [])].sort(),
    cardIdExact: scope.cardIdExact ?? '',
    collectionId: scope.collectionId ?? '',
    // null = library; [] = empty moodboard — must not collide.
    moodboardCardIds: scope.moodboardCardIds == null ? null : [...scope.moodboardCardIds].sort()
  });
}

function normalizeFeedScope(scope: GalleryFeedScope): GalleryFeedScope {
  return {
    libraryScope: scope.libraryScope ?? 'all',
    selectedTagIds: scope.selectedTagIds ?? [],
    cardIdExact: scope.cardIdExact ?? null,
    collectionId: scope.collectionId ?? null,
    moodboardCardIds: scope.moodboardCardIds ?? null
  };
}

export function useRegisterGalleryFeedScope(scope: GalleryFeedScope, enabled = true): void {
  const { setFeedScope } = useGalleryFilters();
  const key = useMemo(
    () => feedScopeKey(scope),
    [
      scope.libraryScope,
      scope.cardIdExact,
      scope.collectionId,
      scope.selectedTagIds,
      scope.moodboardCardIds
    ]
  );
  useEffect(() => {
    if (!enabled) return;
    const next = normalizeFeedScope(scope);
    setFeedScope((prev) => (feedScopeKey(prev) === key ? prev : next));
    // key уже сериализует scope; scope берём из замыкания текущего рендера при смене key
  }, [enabled, key, scope, setFeedScope]);
}
