import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TagRecord } from '../../../services/db';
import { parseDetailCardId, setSearchAndDetailCardInParams } from '../../../search/openCardUrl';
import {
  parseSearchAiQuery,
  parseSearchColorHex,
  parseSearchColorTolerance,
  parseSearchCardId,
  parseSearchTagIds,
  parseSearchSimilarRef
} from '../../../search/searchUrl';
import {
  getRecentTagIds,
  hasCompletedSearchSession,
  markSearchSessionCompleted,
  pushRecentTagId
} from '../../../search/recentSearchTags';
import {
  ARC_RECENT_VIEWS_CHANGED_EVENT,
  getRecentViewedCardIds
} from '../../../search/recentViewedCards';
import {
  ARC_RECENT_AI_QUERIES_CHANGED_EVENT,
  getRecentAiQueries,
  pushRecentAiQuery
} from '../../../search/recentSearchAi';
import { ARC_AI_SEARCH_LOADING_EVENT, dispatchAiSearchLoading } from '../../../search/aiSearchEvents';
import { clearGallerySearchParams } from '../../../search/clearGallerySearch';
import { ARC_SEARCH_QUERY_AI } from '../../../search/searchUrl';
import { clearSimilarUploadPath } from '../../../search/similarSearchSession';
import { rankTagsForQuery, mergeSemanticTagHits } from '../../../search/rankSearchTags';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import {
  ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT,
  readNavbarSearchMode,
  SEARCH_MODE_META,
  type NavbarSearchMode,
  writeNavbarSearchMode
} from '../../../search/navbarSearchMode';
import { useAiNavbarModesVisible } from '../../../hooks/useAiNavbarModesVisible';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import {
  COLOR_SEARCH_PRESETS,
  DEFAULT_COLOR_SEARCH_TOLERANCE
} from '../../../search/colorPresets';
import {
  ARC_START_COLOR_SEARCH_EVENT,
  type StartColorSearchDetail
} from '../../../search/startColorSearch';
import { addTag } from '../../../services/db';
import { firstManualTagCategoryId } from '@arc-main-shared/autoCreatedTagsCategory';
import { showAppNotification } from '../../../services/notificationService';
import TagSettingsModal, { type TagSettingsModalState } from '../../tags/TagSettingsModal';
import { NavbarSearchContextProvider } from './NavbarSearchContext';
import type { NavbarSearchContextValue, NavbarSearchProps } from './types';
import { NAVBAR_SEARCH_MODES } from './modes/registry';
import { useNavbarSearchTagsIndex } from './hooks/useNavbarSearchTagsIndex';
import { useNavbarSearchUrl } from './hooks/useNavbarSearchUrl';
import { useNavbarSimilarSearch } from './hooks/useNavbarSimilarSearch';
import { useNavbarSearchPanel, useSearchIslandRef } from './hooks/useNavbarSearchPanel';
import { useNavbarSearchChipsScroll, useNavbarSearchIslandWidth } from './hooks/useNavbarSearchIslandWidth';
import { removeTagIdFromParams, toggleTagIdInParams } from './utils/searchUrlCommit';
import type { ColorFormat } from '../../../utils/colorFormats';
import {
  readColorSearchFormatPreference,
  writeColorSearchFormatPreference
} from '../../../hooks/useColorFormatPreference';
import { ARC_FOCUS_SEARCH_REQUEST_EVENT } from '../../../shortcuts/focusNavbarSearch';

const COLOR_SEARCH_DEBOUNCE_MS = 280;
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePrefix(q: string): string {
  return q.trim().toLowerCase();
}

export function NavbarSearchProvider({
  onPanelOpenChange,
  islandRef,
  children
}: NavbarSearchProps & { children: React.ReactNode }) {
  const {
    searchParams,
    setSearchParams,
    commitGallerySearchParams,
    resetSearchField: resetSearchFieldUrl,
    handleModeChange: handleModeChangeUrl,
    applyAiQueryToParams,
    applyColorSearch
  } = useNavbarSearchUrl();

  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdFilter = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const aiQuery = useMemo(() => parseSearchAiQuery(searchParams), [searchParams]);
  const colorHex = useMemo(() => parseSearchColorHex(searchParams), [searchParams]);
  const colorTolerance = useMemo(() => parseSearchColorTolerance(searchParams), [searchParams]);
  const detailCardId = useMemo(() => parseDetailCardId(searchParams), [searchParams]);
  const similarRefFromUrl = useMemo(() => parseSearchSimilarRef(searchParams), [searchParams]);

  const [searchMode, setSearchMode] = useState<NavbarSearchMode>(() => readNavbarSearchMode());
  const aiNavbarModesVisible = useAiNavbarModesVisible();
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [recentTick, setRecentTick] = useState(0);
  const [aiSearching, setAiSearching] = useState(false);
  const [panelColorHex, setPanelColorHex] = useState(COLOR_SEARCH_PRESETS[1].hex);
  const [panelColorTolerance, setPanelColorTolerance] = useState(DEFAULT_COLOR_SEARCH_TOLERANCE);
  const [colorFormat, setColorFormatState] = useState<ColorFormat>(() => readColorSearchFormatPreference());
  const [searchIslandWidePinned, setSearchIslandWidePinned] = useState(false);
  const [createTagModal, setCreateTagModal] = useState<TagSettingsModalState | null>(null);
  const [semanticTagHits, setSemanticTagHits] = useState<Array<{ tagId: string; score: number }>>([]);

  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelHadInteraction = useRef(false);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { categories, tagsByCategoryRef, tagsVersion, loadIndex } = useNavbarSearchTagsIndex();
  const { prefs } = useAppPreferences();
  const qwenTagSearchOn = Boolean(
    (prefs?.aiSearchEnabled || prefs?.aiSemanticSearchEnabled) &&
      (prefs?.aiSearchModelId === 'qwen3-vl-embedding-2b' ||
        prefs?.aiSearchModelId === 'qwen3-vl-embedding-8b')
  );
  const similarSearch = useNavbarSimilarSearch(searchParams, setSearchParams, searchMode);

  const tagsIndex = useMemo(() => {
    const m = new Map<string, TagRecord>();
    for (const [, list] of tagsByCategoryRef.current) {
      for (const t of list) m.set(t.id, t);
    }
    return m;
  }, [tagsVersion, tagsByCategoryRef]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const getSearchIsland = useSearchIslandRef(islandRef ?? { current: null }, searchAnchorRef);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSearchIslandWidePinned(false);
    setFieldError(false);
    if (panelHadInteraction.current && !hasCompletedSearchSession()) {
      markSearchSessionCompleted();
    }
    panelHadInteraction.current = false;
  }, []);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    setSearchIslandWidePinned(true);
    if (searchMode === 'tags') {
      void loadIndex();
    }
  }, [loadIndex, searchMode]);

  const openCreateTagModal = useCallback(
    async (initialName: string) => {
      let list = categories;
      let categoryId = firstManualTagCategoryId(list);
      if (!categoryId) {
        list = await loadIndex();
        categoryId = firstManualTagCategoryId(list);
      }
      if (!categoryId) return;
      // Закрываем search до открытия модалки: её lifecycle не должен зависеть от панели.
      closePanel();
      setCreateTagModal({ mode: 'create', categoryId, initialName });
    },
    [categories, closePanel, loadIndex]
  );

  const displayColorHex =
    (searchMode === 'color' ? panelColorHex.replace(/^#/, '') : null) ||
    colorHex ||
    COLOR_SEARCH_PRESETS[1].hex.replace('#', '');

  const hasValue = useMemo(() => {
    return NAVBAR_SEARCH_MODES[searchMode].hasValue({
      draft,
      aiQuery,
      colorHex,
      selectedTagIds,
      cardIdFilter,
      similarSearch
    } as NavbarSearchContextValue);
  }, [searchMode, draft, aiQuery, colorHex, selectedTagIds, cardIdFilter, similarSearch]);

  const { dropdownLayout } = useNavbarSearchPanel({
    panelOpen,
    getSearchIsland,
    onClose: closePanel,
    onPanelOpenChange,
    detailCardId,
    setPanelOpen,
    setFieldError,
    layoutDeps: [draft, selectedTagIds.length, cardIdFilter]
  });

  const { scrollFade, ensureInputVisible, onScrollTrackWheel } = useNavbarSearchChipsScroll(
    scrollTrackRef,
    searchInputRef,
    [selectedTagIds.length, cardIdFilter, aiQuery, draft]
  );

  useNavbarSearchIslandWidth({
    panelOpen,
    hasValue,
    searchIslandWidePinned,
    searchMode,
    aiNavbarModesVisible,
    getSearchIsland,
    measureRef
  });

  const aiNavbarModesVisibleRef = useRef(aiNavbarModesVisible);

  useEffect(() => {
    const wasVisible = aiNavbarModesVisibleRef.current;
    aiNavbarModesVisibleRef.current = aiNavbarModesVisible;
    if (!wasVisible || aiNavbarModesVisible) return;

    const hasAiOrSimilar =
      Boolean(parseSearchAiQuery(searchParams)) || Boolean(parseSearchSimilarRef(searchParams));
    if (!hasAiOrSimilar) return;
    setSearchMode('tags');
    writeNavbarSearchMode('tags');
    clearSimilarUploadPath();
    setSearchParams(clearGallerySearchParams(searchParams), { replace: true });
  }, [aiNavbarModesVisible, searchParams, setSearchParams]);

  useEffect(() => {
    if (similarRefFromUrl && searchMode !== 'similar') {
      setSearchMode('similar');
      writeNavbarSearchMode('similar');
    }
  }, [similarRefFromUrl, searchMode]);

  // Только когда color= только что появился в URL — не откатывать ручной уход из режима «Цвет».
  const prevColorHexRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevColorHexRef.current;
    prevColorHexRef.current = colorHex;
    if (!colorHex || colorHex === prev) return;
    if (searchMode === 'color') return;
    setSearchMode('color');
    writeNavbarSearchMode('color');
  }, [colorHex, searchMode]);

  const applyColorSearchRef = useRef(applyColorSearch);
  applyColorSearchRef.current = applyColorSearch;

  useEffect(() => {
    const onStartColorSearch = (event: Event) => {
      const detail = (event as CustomEvent<StartColorSearchDetail>).detail;
      const hex = detail?.hex?.trim();
      if (!hex) return;
      if (colorDebounceRef.current) {
        clearTimeout(colorDebounceRef.current);
        colorDebounceRef.current = null;
      }
      const normalized = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
      const tolerance = detail.tolerance ?? DEFAULT_COLOR_SEARCH_TOLERANCE;
      setSearchMode('color');
      setPanelColorHex(normalized);
      setPanelColorTolerance(tolerance);
      setDraft('');
      setFieldError(false);
      panelHadInteraction.current = true;
      // Дублируем запись color= из провайдера: иначе эффект «дефолтный цвет»
      // или устаревший setSearchParams мог обогнать navigate из деталки.
      applyColorSearchRef.current(normalized, tolerance);
    };
    window.addEventListener(ARC_START_COLOR_SEARCH_EVENT, onStartColorSearch);
    return () => window.removeEventListener(ARC_START_COLOR_SEARCH_EVENT, onStartColorSearch);
  }, []);

  useEffect(() => {
    const onModeChanged = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: NavbarSearchMode }>).detail?.mode;
      if (mode === 'tags' || mode === 'ai' || mode === 'color' || mode === 'similar') {
        setSearchMode(mode);
      }
    };
    window.addEventListener(ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT, onModeChanged);
    return () => window.removeEventListener(ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT, onModeChanged);
  }, []);

  useEffect(() => {
    const onRecentViews = () => setRecentTick((x) => x + 1);
    window.addEventListener(ARC_RECENT_VIEWS_CHANGED_EVENT, onRecentViews);
    window.addEventListener(ARC_RECENT_AI_QUERIES_CHANGED_EVENT, onRecentViews);
    return () => {
      window.removeEventListener(ARC_RECENT_VIEWS_CHANGED_EVENT, onRecentViews);
      window.removeEventListener(ARC_RECENT_AI_QUERIES_CHANGED_EVENT, onRecentViews);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    };
  }, []);

  const toggleTag = useCallback(
    (tagId: string) => {
      panelHadInteraction.current = true;
      const had = selectedTagIds.includes(tagId);
      if (!had) {
        pushRecentTagId(tagId);
        setRecentTick((x) => x + 1);
      }
      commitGallerySearchParams((prev) => toggleTagIdInParams(prev, tagId, selectedTagIds));
      setDraft('');
      setFieldError(false);
    },
    [commitGallerySearchParams, selectedTagIds]
  );

  const removeTag = useCallback(
    (tagId: string) => {
      panelHadInteraction.current = true;
      commitGallerySearchParams((prev) => removeTagIdFromParams(prev, tagId, selectedTagIds));
    },
    [commitGallerySearchParams, selectedTagIds]
  );

  const applyColorSearchDebounced = useCallback(
    (hex: string, tolerance: number) => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = setTimeout(() => {
        panelHadInteraction.current = true;
        applyColorSearch(hex, tolerance);
        setFieldError(false);
      }, COLOR_SEARCH_DEBOUNCE_MS);
    },
    [applyColorSearch]
  );

  const handlePanelColorChange = useCallback(
    (hex: string) => {
      setPanelColorHex(hex);
      applyColorSearchDebounced(hex, panelColorTolerance);
    },
    [applyColorSearchDebounced, panelColorTolerance]
  );

  const setColorFormat = useCallback((format: ColorFormat) => {
    setColorFormatState(format);
    writeColorSearchFormatPreference(format);
  }, []);

  const handlePanelToleranceChange = useCallback(
    (value: number) => {
      setPanelColorTolerance(value);
      applyColorSearchDebounced(panelColorHex, value);
    },
    [applyColorSearchDebounced, panelColorHex]
  );

  const resetSearchField = useCallback(() => {
    panelHadInteraction.current = true;
    resetSearchFieldUrl();
    setDraft('');
    setFieldError(false);
  }, [resetSearchFieldUrl]);

  const clearAiSearch = useCallback(() => {
    panelHadInteraction.current = true;
    setDraft('');
    setFieldError(false);
    setSearchIslandWidePinned(true);
    commitGallerySearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(ARC_SEARCH_QUERY_AI);
      return next;
    });
  }, [commitGallerySearchParams]);

  const cancelAiSearch = useCallback(() => {
    panelHadInteraction.current = true;
    setFieldError(false);
    setSearchIslandWidePinned(true);
    dispatchAiSearchLoading(false);
    commitGallerySearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(ARC_SEARCH_QUERY_AI);
      return next;
    });
  }, [commitGallerySearchParams]);

  const clearAiDraft = useCallback(() => {
    panelHadInteraction.current = true;
    setDraft('');
    setFieldError(false);
    setSearchIslandWidePinned(true);
  }, []);

  const applyAiQuery = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (!query) {
        setFieldError(true);
        return;
      }
      panelHadInteraction.current = true;
      pushRecentAiQuery(query);
      setRecentTick((x) => x + 1);
      applyAiQueryToParams(query);
      setDraft(query);
      setFieldError(false);
      closePanel();
    },
    [applyAiQueryToParams, closePanel]
  );

  const handleModeChange = useCallback(
    (mode: NavbarSearchMode) => {
      if (colorDebounceRef.current) {
        clearTimeout(colorDebounceRef.current);
        colorDebounceRef.current = null;
      }
      setSearchIslandWidePinned(false);
      handleModeChangeUrl(mode, searchMode, {
        setSearchMode,
        setPanelColorHex,
        setPanelColorTolerance,
        setDraft,
        setFieldError,
        setPanelOpen
      });
    },
    [handleModeChangeUrl, searchMode]
  );

  useEffect(() => {
    const onFocusRequest = () => {
      handleModeChange('tags');
      openPanel();
      setSearchIslandWidePinned(true);
      void loadIndex();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          ensureInputVisible();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      });
    };
    window.addEventListener(ARC_FOCUS_SEARCH_REQUEST_EVENT, onFocusRequest);
    return () => window.removeEventListener(ARC_FOCUS_SEARCH_REQUEST_EVENT, onFocusRequest);
  }, [ensureInputVisible, handleModeChange, loadIndex, openPanel]);

  const applyCardIdFilter = useCallback(
    (raw: string) => {
      const id = raw.trim();
      if (!id) return;
      panelHadInteraction.current = true;
      commitGallerySearchParams((prev) => setSearchAndDetailCardInParams(prev, id));
      setDraft('');
      setFieldError(false);
      markSearchSessionCompleted();
    },
    [commitGallerySearchParams]
  );

  const q = normalizePrefix(draft);
  useEffect(() => {
    if (searchMode !== 'tags' || !qwenTagSearchOn) {
      setSemanticTagHits([]);
      return;
    }
    const query = q.trim();
    if (query.length < 2 || !window.arc?.rankTagsSemantic) {
      setSemanticTagHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void window.arc
        .rankTagsSemantic!(query)
        .then((hits) => {
          if (!cancelled) setSemanticTagHits(Array.isArray(hits) ? hits : []);
        })
        .catch(() => {
          if (!cancelled) setSemanticTagHits([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, qwenTagSearchOn, searchMode]);

  const rankedTags = useMemo(() => {
    const base = rankTagsForQuery(q, categories, tagsByCategoryRef.current);
    return mergeSemanticTagHits(base, semanticTagHits, categories, tagsByCategoryRef.current);
  }, [categories, q, semanticTagHits, tagsVersion, tagsByCategoryRef]);
  const suggestionMatchesDraft = q.length > 0 && rankedTags.length > 0;

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (searchMode === 'ai') {
        if (draft.trim().length > 0) {
          applyAiQuery(draft);
        } else {
          setFieldError(true);
        }
        return;
      }
      if (UUID_LIKE.test(draft.trim())) {
        applyCardIdFilter(draft.trim());
        closePanel();
        return;
      }
      if (q.length > 0 && !suggestionMatchesDraft && !UUID_LIKE.test(draft.trim())) {
        setFieldError(true);
      }
    },
    [applyAiQuery, applyCardIdFilter, closePanel, draft, q, searchMode, suggestionMatchesDraft]
  );

  const placeholder = SEARCH_MODE_META[searchMode].placeholder;
  const showAiSend = searchMode === 'ai' && draft.trim().length > 0 && !aiSearching;
  const showAiClearDraft = searchMode === 'ai' && draft.trim().length > 0 && !aiSearching;
  const showAiClearResult =
    searchMode === 'ai' && !aiSearching && Boolean(aiQuery) && draft.trim().length === 0;

  useEffect(() => {
    if (searchMode !== 'ai') return;
    setDraft(aiQuery ?? '');
  }, [aiQuery, searchMode]);

  // Синхронизация панели с URL. Дефолтный color= ставит только handleModeChange —
  // авто-apply здесь гонялся с startColorSearch и затирал выбранный HEX.
  useEffect(() => {
    if (searchMode !== 'color' || !colorHex) return;
    setPanelColorHex(`#${colorHex}`);
    setPanelColorTolerance(colorTolerance);
  }, [colorHex, colorTolerance, searchMode]);

  useEffect(() => {
    const onLoading = (e: Event) => {
      const detail = (e as CustomEvent<{ loading: boolean }>).detail;
      setAiSearching(Boolean(detail?.loading));
    };
    window.addEventListener(ARC_AI_SEARCH_LOADING_EVENT, onLoading);
    return () => window.removeEventListener(ARC_AI_SEARCH_LOADING_EVENT, onLoading);
  }, []);

  const recentIds = useMemo(() => getRecentTagIds(), [panelOpen, tagsVersion, recentTick]);
  const recentAiIds = useMemo(() => getRecentAiQueries(), [panelOpen, recentTick]);
  const recentViewedIds = useMemo(() => getRecentViewedCardIds(), [panelOpen, recentTick]);

  useLayoutEffect(() => {
    if (searchAnchorRef.current) void hydrateArcNavbarIcons(searchAnchorRef.current);
  }, [
    showAiSend,
    showAiClearDraft,
    showAiClearResult,
    aiSearching,
    panelOpen,
    searchMode,
    displayColorHex,
    aiNavbarModesVisible
  ]);

  const selectRecentCard = useCallback(
    (id: string) => {
      panelHadInteraction.current = true;
      commitGallerySearchParams((prev) => setSearchAndDetailCardInParams(prev, id));
      setDraft('');
      setFieldError(false);
      markSearchSessionCompleted();
      closePanel();
    },
    [closePanel, commitGallerySearchParams]
  );

  const selectRecentAiQuery = useCallback((query: string) => {
    panelHadInteraction.current = true;
    setDraft(query);
    setFieldError(false);
    setSearchIslandWidePinned(true);
  }, []);

  const reuseRecentAiQuery = useCallback(
    (query: string) => {
      panelHadInteraction.current = true;
      applyAiQuery(query);
    },
    [applyAiQuery]
  );

  const contextValue: NavbarSearchContextValue = {
    searchMode,
    setSearchMode,
    aiNavbarModesVisible,
    draft,
    setDraft,
    panelOpen,
    openPanel,
    closePanel,
    fieldError,
    setFieldError,
    hasValue,
    placeholder,
    q,
    rankedTags,
    selectedTagIds,
    cardIdFilter,
    aiQuery,
    colorHex,
    colorTolerance,
    displayColorHex,
    colorFormat,
    setColorFormat,
    categories,
    tagsIndex,
    categoryById,
    recentIds,
    recentAiIds,
    recentViewedIds,
    recentTick,
    setRecentTick,
    aiSearching,
    panelColorHex,
    panelColorTolerance,
    similarSearch,
    dropdownLayout,
    scrollFade,
    searchAnchorRef,
    measureRef,
    scrollTrackRef,
    searchInputRef,
    panelHadInteraction,
    handleModeChange,
    toggleTag,
    removeTag,
    resetSearchField,
    clearAiSearch,
    cancelAiSearch,
    clearAiDraft,
    applyAiQuery,
    applyCardIdFilter,
    handlePanelColorChange,
    handlePanelToleranceChange,
    onInputKeyDown,
    onScrollTrackWheel,
    ensureInputVisible,
    selectRecentCard,
    selectRecentAiQuery,
    reuseRecentAiQuery,
    showAiSend,
    showAiClearDraft,
    showAiClearResult,
    loadIndex,
    openCreateTagModal,
    searchParams,
    setSearchParams
  };

  return (
    <NavbarSearchContextProvider value={contextValue}>
      {children}
      {createTagModal ? (
        <TagSettingsModal
          state={createTagModal}
          categories={categories}
          onClose={() => setCreateTagModal(null)}
          onCreate={async (payload) => {
            await addTag(payload.categoryId, payload.name, {
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
            await loadIndex();
            setCreateTagModal(null);
            showAppNotification({
              message: 'Метка создана',
              variant: 'success',
              skipPrefCheck: true
            });
          }}
          onSave={async () => {}}
          onDelete={async () => {}}
        />
      ) : null}
    </NavbarSearchContextProvider>
  );
}
