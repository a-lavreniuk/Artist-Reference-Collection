import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
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
  countActiveFilterCategories,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  layoutToPresetItems,
  migrateGalleryAdvancedFilters,
  presetItemsToLayout,
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

type GalleryFilterContextValue = {
  filters: GalleryAdvancedFilters;
  setFilters: (next: GalleryAdvancedFilters) => void;
  patchFilters: (patch: Partial<GalleryAdvancedFilters>) => void;
  clearFilters: () => void;
  clearFilterCategory: (id: GalleryFilterId) => void;
  sort: GallerySortState;
  setSort: (next: GallerySortState) => void;
  layout: GalleryFilterLayoutState;
  setLayout: (next: GalleryFilterLayoutState) => void;
  reorderFilter: (id: GalleryFilterId, toIndex: number) => void;
  toggleFilterVisibility: (id: GalleryFilterId) => void;
  feedScope: GalleryFeedScope;
  setFeedScope: (scope: GalleryFeedScope) => void;
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

export function GalleryFilterProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const mainTabRef = useRef(resolveMainTab(location.pathname));

  const [filters, setFilters] = useState<GalleryAdvancedFilters>(emptyGalleryAdvancedFilters);
  const [sort, setSort] = useState<GallerySortState>(DEFAULT_GALLERY_SORT);
  const [layout, setLayoutState] = useState<GalleryFilterLayoutState>(() => readGalleryFilterLayout());
  const [feedScope, setFeedScope] = useState<GalleryFeedScope>({ libraryScope: 'all' });
  const [stats, setStats] = useState<GalleryFilterStats | null>(null);
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [shuffleReloading, setShuffleReloading] = useState(false);

  const setLayout = useCallback((next: GalleryFilterLayoutState) => {
    setLayoutState(next);
    writeGalleryFilterLayout(next);
  }, []);

  const patchFilters = useCallback((patch: Partial<GalleryAdvancedFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyGalleryAdvancedFilters());
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
    const tab = resolveMainTab(location.pathname);
    if (tab !== mainTabRef.current) {
      mainTabRef.current = tab;
      setSort(DEFAULT_GALLERY_SORT);
      setFilters(emptyGalleryAdvancedFilters());
    }
  }, [location.pathname]);

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
    patchFilters({ duration: [] });
  }, [stats, filters.duration.length, patchFilters]);

  useEffect(() => {
    if (!stats || filters.fileExtensions.length === 0) return;
    const anyExtStillPresent = filters.fileExtensions.some(
      (ext) => (stats.fileExtensions[ext] ?? 0) > 0
    );
    if (!anyExtStillPresent) patchFilters({ fileExtensions: [] });
  }, [stats, filters.fileExtensions, patchFilters]);

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
      setFilters(migrateGalleryAdvancedFilters(preset.payload.filters));
      setSort(preset.payload.sort);
      const nextLayout = presetItemsToLayout(preset.payload.layout);
      setLayout(nextLayout);
    },
    [setLayout]
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
      patchFilters,
      clearFilters,
      clearFilterCategory,
      sort,
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
    moodboardCardIds: [...(scope.moodboardCardIds ?? [])].sort()
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
