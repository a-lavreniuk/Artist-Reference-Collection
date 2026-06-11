import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { useLocation } from 'react-router-dom';
import { resolveMainTab } from '../layout/navbarLayout';
import {
  moveFilterInLayout,
  readGalleryFilterLayout,
  setFilterVisibility,
  writeGalleryFilterLayout
} from './galleryFilterLayout';
import {
  countActiveFilterCategories,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters,
  layoutToPresetItems,
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
  sort: GallerySortState;
  setSort: (next: GallerySortState) => void;
  layout: GalleryFilterLayoutState;
  setLayout: (next: GalleryFilterLayoutState) => void;
  moveFilter: (id: GalleryFilterId, direction: 'up' | 'down') => void;
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

  const moveFilter = useCallback(
    (id: GalleryFilterId, direction: 'up' | 'down') => {
      setLayout(moveFilterInLayout(layout, id, direction));
    },
    [layout, setLayout]
  );

  const toggleFilterVisibility = useCallback(
    (id: GalleryFilterId) => {
      setLayout(setFilterVisibility(layout, id, !layout.visible[id]));
    },
    [layout, setLayout]
  );

  useEffect(() => {
    const tab = resolveMainTab(location.pathname);
    if (tab !== mainTabRef.current) {
      mainTabRef.current = tab;
      setSort(DEFAULT_GALLERY_SORT);
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
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

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
      setFilters(preset.payload.filters);
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
      sort,
      setSort,
      layout,
      setLayout,
      moveFilter,
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
      activeCategoryCount
    }),
    [
      filters,
      patchFilters,
      clearFilters,
      sort,
      layout,
      setLayout,
      moveFilter,
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
      activeCategoryCount
    ]
  );

  return <GalleryFilterContext.Provider value={value}>{children}</GalleryFilterContext.Provider>;
}

export function useGalleryFilters(): GalleryFilterContextValue {
  const ctx = useContext(GalleryFilterContext);
  if (!ctx) throw new Error('useGalleryFilters вне GalleryFilterProvider');
  return ctx;
}

export function useRegisterGalleryFeedScope(scope: GalleryFeedScope): void {
  const { setFeedScope } = useGalleryFilters();
  const key = useMemo(
    () =>
      JSON.stringify({
        libraryScope: scope.libraryScope ?? 'all',
        selectedTagIds: [...(scope.selectedTagIds ?? [])].sort(),
        cardIdExact: scope.cardIdExact ?? '',
        collectionId: scope.collectionId ?? '',
        moodboardCardIds: [...(scope.moodboardCardIds ?? [])].sort()
      }),
    [scope]
  );
  useEffect(() => {
    setFeedScope(scope);
  }, [key, scope, setFeedScope]);
}
