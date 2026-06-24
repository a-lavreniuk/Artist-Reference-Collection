import './NavbarSearch.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import {
  ARC_DETAIL_QUERY_CARD,
  parseDetailCardId,
  removeCardFilterFromParams,
  setSearchAndDetailCardInParams
} from '../../search/openCardUrl';
import {
  ARC_SEARCH_QUERY_AI,
  ARC_SEARCH_QUERY_CARD,
  ARC_SEARCH_QUERY_COLOR,
  ARC_SEARCH_QUERY_COLOR_TOL,
  ARC_SEARCH_QUERY_SIMILAR,
  ARC_SEARCH_QUERY_SIMILAR_CROP,
  ARC_SEARCH_QUERY_TAG,
  parseSearchAiQuery,
  parseSearchColorHex,
  parseSearchColorTolerance,
  parseSearchCardId,
  parseSearchTagIds,
  setSearchAiInParams,
  setSearchColorInParams,
  parseSearchSimilarRef
} from '../../search/searchUrl';
import {
  getRecentTagIds,
  hasCompletedSearchSession,
  markSearchSessionCompleted,
  pushRecentTagId,
  removeRecentTagId,
  clearAllRecentTagIds
} from '../../search/recentSearchTags';
import {
  ARC_RECENT_VIEWS_CHANGED_EVENT,
  clearAllRecentViewedCardIds,
  getRecentViewedCardIds
} from '../../search/recentViewedCards';
import {
  ARC_RECENT_AI_QUERIES_CHANGED_EVENT,
  clearAllRecentAiQueries,
  getRecentAiQueries,
  pushRecentAiQuery
} from '../../search/recentSearchAi';
import { ARC_AI_SEARCH_LOADING_EVENT } from '../../search/aiSearchEvents';
import { clearGallerySearchParams } from '../../search/clearGallerySearch';
import { clearSimilarUploadPath } from '../../search/similarSearchSession';
import { useGalleryFilters } from '../gallery/GalleryFilterContext';
import { rankTagsForQuery } from '../../search/rankSearchTags';
import SearchPanelSection from './SearchPanelSection';
import SearchPanelRecentCards from './SearchPanelRecentCards';
import SearchPanelModeHeader from './SearchPanelModeHeader';
import SearchPanelFullBleedSep from './SearchPanelFullBleedSep';
import SearchPanelTagChip from './SearchPanelTagChip';
import SearchPanelRecentQueries from './SearchPanelRecentQueries';
import SearchPanelColorControls from './SearchPanelColorControls';
import SearchPanelSimilarControls from './SearchPanelSimilarControls';
import { useNavbarSimilarSearch } from './useNavbarSimilarSearch';
import NavbarSearchModes from './NavbarSearchModes';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { formatNavbarTabCount } from '../../search/formatNavbarTabCount';
import {
  ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT,
  readNavbarSearchMode,
  SEARCH_MODE_META,
  type NavbarSearchMode,
  writeNavbarSearchMode
} from '../../search/navbarSearchMode';
import { useAiNavbarModesVisible } from '../../hooks/useAiNavbarModesVisible';
import {
  COLOR_SEARCH_PRESETS,
  DEFAULT_COLOR_SEARCH_TOLERANCE
} from '../../search/colorPresets';

export { formatNavbarTabCount } from '../../search/formatNavbarTabCount';

const COLOR_SEARCH_DEBOUNCE_MS = 280;
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePrefix(q: string): string {
  return q.trim().toLowerCase();
}

type NavbarSearchProps = {
  onPanelOpenChange?: (open: boolean) => void;
};

export default function NavbarSearch({ onPanelOpenChange }: NavbarSearchProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdFilter = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const aiQuery = useMemo(() => parseSearchAiQuery(searchParams), [searchParams]);
  const colorHex = useMemo(() => parseSearchColorHex(searchParams), [searchParams]);
  const colorTolerance = useMemo(() => parseSearchColorTolerance(searchParams), [searchParams]);
  const detailCardId = useMemo(() => parseDetailCardId(searchParams), [searchParams]);

  const [searchMode, setSearchMode] = useState<NavbarSearchMode>(() => readNavbarSearchMode());
  const aiNavbarModesVisible = useAiNavbarModesVisible();

  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const tagsByCategoryRef = useRef<Map<string, TagRecord[]>>(new Map());
  const [tagsVersion, setTagsVersion] = useState(0);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scrollFade, setScrollFade] = useState({ start: false, end: false });
  const [dropdownLayout, setDropdownLayout] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [fieldError, setFieldError] = useState(false);
  const [recentTick, setRecentTick] = useState(0);
  const [aiSearching, setAiSearching] = useState(false);
  const [panelColorHex, setPanelColorHex] = useState(COLOR_SEARCH_PRESETS[1].hex);
  const [panelColorTolerance, setPanelColorTolerance] = useState(DEFAULT_COLOR_SEARCH_TOLERANCE);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { clearFilters } = useGalleryFilters();

  const similarRefFromUrl = useMemo(() => parseSearchSimilarRef(searchParams), [searchParams]);
  const similarSearch = useNavbarSimilarSearch(searchParams, setSearchParams, searchMode, panelOpen);

  const tagsIndex = useMemo(() => {
    const m = new Map<string, TagRecord>();
    for (const [, list] of tagsByCategoryRef.current) {
      for (const t of list) m.set(t.id, t);
    }
    return m;
  }, [tagsVersion]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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

  const loadIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const sorted = [...cats].sort((a, b) => a.sortIndex - b.sortIndex);
    setCategories(sorted);
    const map = new Map<string, TagRecord[]>();
    await Promise.all(
      sorted.map(async (c) => {
        const tags = await getTagsByCategory(c.id);
        map.set(c.id, tags);
      })
    );
    tagsByCategoryRef.current = map;
    setTagsVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

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
    const onCats = () => void loadIndex();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    };
  }, [loadIndex]);

  const navigateToSearchHost = useCallback(() => {
    if (location.pathname.startsWith('/collections')) {
      return;
    }
    if (location.pathname !== '/gallery') {
      const s = searchParams.toString();
      navigate({ pathname: '/gallery', search: s ? `?${s}` : '' });
    }
  }, [location.pathname, navigate, searchParams]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    if (searchMode === 'tags') {
      navigateToSearchHost();
      void loadIndex();
    }
  }, [loadIndex, navigateToSearchHost, searchMode]);

  const panelHadInteraction = useRef(false);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setFieldError(false);
    if (panelHadInteraction.current && !hasCompletedSearchSession()) {
      markSearchSessionCompleted();
    }
    panelHadInteraction.current = false;
  }, []);

  const updateDropdownLayout = useCallback(() => {
    if (!panelOpen || !searchAnchorRef.current) return;
    const r = searchAnchorRef.current.getBoundingClientRect();
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--s-2').trim();
    const gapBelowInput = Number.parseFloat(raw) || 8;
    setDropdownLayout({ top: r.bottom + gapBelowInput, left: r.left, width: r.width });
  }, [panelOpen]);

  const syncScrollFade = useCallback(() => {
    const track = scrollTrackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const overflow = scrollWidth > clientWidth + 1;
    setScrollFade({
      start: overflow && scrollLeft > 1,
      end: overflow && scrollLeft + clientWidth < scrollWidth - 1
    });
  }, []);

  const scrollChipsToEnd = useCallback(() => {
    const viewport = scrollTrackRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    syncScrollFade();
  }, [syncScrollFade]);

  const ensureInputVisible = useCallback(() => {
    const viewport = scrollTrackRef.current;
    const input = searchInputRef.current;
    if (!viewport || !input) return;
    const pad = 8;
    const vRect = viewport.getBoundingClientRect();
    const iRect = input.getBoundingClientRect();
    if (iRect.right > vRect.right - pad) {
      viewport.scrollLeft += iRect.right - vRect.right + pad;
    }
    if (iRect.left < vRect.left + pad) {
      viewport.scrollLeft -= vRect.left - iRect.left + pad;
    }
    syncScrollFade();
  }, [syncScrollFade]);

  useLayoutEffect(() => {
    scrollChipsToEnd();
  }, [selectedTagIds.length, cardIdFilter, scrollChipsToEnd, draft]);

  useLayoutEffect(() => {
    const viewport = scrollTrackRef.current;
    if (!viewport) return;
    syncScrollFade();
    const ro = new ResizeObserver(() => syncScrollFade());
    ro.observe(viewport);
    if (viewport.firstElementChild) {
      ro.observe(viewport.firstElementChild);
    }
    viewport.addEventListener('scroll', syncScrollFade, { passive: true });
    return () => {
      ro.disconnect();
      viewport.removeEventListener('scroll', syncScrollFade);
    };
  }, [syncScrollFade, selectedTagIds.length, cardIdFilter, aiQuery]);

  const onScrollTrackWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const track = scrollTrackRef.current;
    if (!track || track.scrollWidth <= track.clientWidth + 1) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    track.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  useLayoutEffect(() => {
    updateDropdownLayout();
  }, [panelOpen, draft, selectedTagIds.length, cardIdFilter, updateDropdownLayout]);

  useEffect(() => {
    if (!panelOpen) return;
    const onMove = () => updateDropdownLayout();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [panelOpen, updateDropdownLayout]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  useEffect(() => {
    onPanelOpenChange?.(panelOpen);
  }, [panelOpen, onPanelOpenChange]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    document.body.classList.add('arc-search-panel-open');
    return () => {
      document.body.classList.remove('arc-search-panel-open');
    };
  }, [panelOpen]);

  /** Панель поиска не должна перекрывать detail-карточку (z-index выше overlay). */
  useEffect(() => {
    if (!detailCardId) return;
    setPanelOpen(false);
    setFieldError(false);
  }, [detailCardId]);

  const toggleTag = (tagId: string) => {
    panelHadInteraction.current = true;
    const had = selectedTagIds.includes(tagId);
    const next = new Set(selectedTagIds);
    if (had) next.delete(tagId);
    else {
      next.add(tagId);
      pushRecentTagId(tagId);
      setRecentTick((x) => x + 1);
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete(ARC_SEARCH_QUERY_TAG);
        for (const id of [...next]) {
          n.append(ARC_SEARCH_QUERY_TAG, id);
        }
        n.delete(ARC_SEARCH_QUERY_CARD);
        return n;
      },
      { replace: true }
    );
    setDraft('');
    setFieldError(false);
  };

  const removeTag = (tagId: string) => {
    panelHadInteraction.current = true;
    const next = selectedTagIds.filter((id) => id !== tagId);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete(ARC_SEARCH_QUERY_TAG);
        for (const id of next) {
          n.append(ARC_SEARCH_QUERY_TAG, id);
        }
        return n;
      },
      { replace: true }
    );
  };

  const applyColorSearch = useCallback(
    (hex: string, tolerance: number) => {
      panelHadInteraction.current = true;
      const base = clearGallerySearchParams(searchParams);
      setSearchParams(setSearchColorInParams(base, hex, tolerance), { replace: true });
      setFieldError(false);
    },
    [searchParams, setSearchParams]
  );

  const applyColorSearchDebounced = useCallback(
    (hex: string, tolerance: number) => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = setTimeout(() => {
        applyColorSearch(hex, tolerance);
      }, COLOR_SEARCH_DEBOUNCE_MS);
    },
    [applyColorSearch]
  );

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    };
  }, []);

  const handlePanelColorChange = useCallback(
    (hex: string) => {
      setPanelColorHex(hex);
      applyColorSearchDebounced(hex, panelColorTolerance);
    },
    [applyColorSearchDebounced, panelColorTolerance]
  );

  const handlePanelToleranceChange = useCallback(
    (value: number) => {
      setPanelColorTolerance(value);
      applyColorSearchDebounced(panelColorHex, value);
    },
    [applyColorSearchDebounced, panelColorHex]
  );

  /** Полный сброс: текст, все метки, фильтр по ID; панель поиска не закрываем. */
  const resetSearchField = () => {
    panelHadInteraction.current = true;
    clearSimilarUploadPath();
    const n = clearGallerySearchParams(searchParams);
    n.delete(ARC_DETAIL_QUERY_CARD);
    setSearchParams(n, { replace: true });
    setDraft('');
    setFieldError(false);
  };

  const applyAiQuery = (raw: string) => {
    const query = raw.trim();
    if (!query) {
      setFieldError(true);
      return;
    }
    panelHadInteraction.current = true;
    pushRecentAiQuery(query);
    setRecentTick((x) => x + 1);
    const base = clearGallerySearchParams(searchParams);
    setSearchParams(setSearchAiInParams(base, query), { replace: true });
    setDraft(query);
    setFieldError(false);
    closePanel();
  };

  const handleModeChange = (mode: NavbarSearchMode) => {
    if (mode === searchMode) return;
    setSearchMode(mode);
    writeNavbarSearchMode(mode);
    clearFilters();
    const n = new URLSearchParams(searchParams);
    n.delete(ARC_SEARCH_QUERY_TAG);
    n.delete(ARC_SEARCH_QUERY_CARD);
    n.delete(ARC_SEARCH_QUERY_AI);
    n.delete(ARC_SEARCH_QUERY_COLOR);
    n.delete(ARC_SEARCH_QUERY_COLOR_TOL);
    n.delete(ARC_SEARCH_QUERY_SIMILAR);
    n.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
    n.delete(ARC_DETAIL_QUERY_CARD);
    clearSimilarUploadPath();
    if (mode === 'color') {
      const defaultHex = COLOR_SEARCH_PRESETS[1].hex;
      setPanelColorHex(defaultHex);
      setPanelColorTolerance(DEFAULT_COLOR_SEARCH_TOLERANCE);
      setSearchParams(
        setSearchColorInParams(n, defaultHex, DEFAULT_COLOR_SEARCH_TOLERANCE),
        { replace: true }
      );
    } else {
      setSearchParams(n, { replace: true });
    }
    setDraft('');
    setFieldError(false);
    setPanelOpen(false);
  };

  const applyCardIdFilter = (raw: string) => {
    const id = raw.trim();
    if (!id) return;
    panelHadInteraction.current = true;
    setSearchParams(setSearchAndDetailCardInParams(searchParams, id));
    setDraft('');
    setFieldError(false);
    markSearchSessionCompleted();
  };

  const q = normalizePrefix(draft);

  const rankedTags = useMemo(
    () => rankTagsForQuery(q, categories, tagsByCategoryRef.current),
    [categories, q, tagsVersion]
  );

  const suggestionMatchesDraft = q.length > 0 && rankedTags.length > 0;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
        return;
      }
    }
  };

  const placeholder = SEARCH_MODE_META[searchMode].placeholder;
  const isTagsMode = searchMode === 'tags';
  const isAiMode = searchMode === 'ai';
  const isColorMode = searchMode === 'color';
  const isSimilarMode = searchMode === 'similar';
  const displayColorHex = colorHex ?? COLOR_SEARCH_PRESETS[1].hex.replace('#', '');

  const hasValue = isAiMode
    ? draft.trim().length > 0 || Boolean(aiQuery)
    : isColorMode
      ? Boolean(colorHex)
      : isSimilarMode
        ? similarSearch.hasSimilarQuery
        : draft.trim().length > 0 || selectedTagIds.length > 0 || Boolean(cardIdFilter);

  const showAiSend = isAiMode && draft.trim().length > 0 && !aiSearching;
  const showAiClear = isAiMode && hasValue && !aiSearching;

  useEffect(() => {
    if (!isAiMode) return;
    setDraft(aiQuery ?? '');
  }, [aiQuery, isAiMode]);

  useEffect(() => {
    if (!isColorMode) return;
    if (colorHex) {
      setPanelColorHex(`#${colorHex}`);
      setPanelColorTolerance(colorTolerance);
      return;
    }
    applyColorSearch(COLOR_SEARCH_PRESETS[1].hex, DEFAULT_COLOR_SEARCH_TOLERANCE);
  }, [applyColorSearch, colorHex, colorTolerance, isColorMode]);

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

  const showRecentTags = recentIds.length > 0;
  const showRecentAi = recentAiIds.length > 0;
  const showRecentViews = recentViewedIds.length > 0;
  const hasRecentSectionsTags = showRecentTags || showRecentViews;
  const hasRecentSectionsAi = showRecentAi || showRecentViews;

  const hasRecentSectionsColor = showRecentViews;

  useLayoutEffect(() => {
    if (searchAnchorRef.current) void hydrateArcNavbarIcons(searchAnchorRef.current);
  }, [showAiSend, aiSearching, panelOpen, searchMode, displayColorHex]);

  const selectRecentCard = (id: string) => {
    panelHadInteraction.current = true;
    setSearchParams(setSearchAndDetailCardInParams(searchParams, id), { replace: true });
    setDraft('');
    setFieldError(false);
    markSearchSessionCompleted();
    closePanel();
  };

  const selectRecentAiQuery = (query: string) => {
    panelHadInteraction.current = true;
    setDraft(query);
    setFieldError(false);
  };

  return (
    <>
      <div className="arc-navbar-search-anchor" ref={searchAnchorRef}>
      <div className="arc-navbar-search-row">
        <NavbarSearchModes mode={searchMode} aiSearchEnabled={aiNavbarModesVisible} onModeChange={handleModeChange} />
        <div className="arc-navbar-search-stack">
        <div
          className={`field field-full arc-navbar-search-live${isTagsMode ? ' search-multiselect-live' : ''}${hasValue ? ' has-value' : ''}${fieldError ? ' field-error' : ''}`}
          data-live-search-multi={isTagsMode ? '' : undefined}
        >
          <div
            className={`input input--size-l input-slots arc-navbar-search${
              isTagsMode
                ? ' search-multiselect'
                : isColorMode
                  ? ' arc-navbar-search--color'
                  : isSimilarMode
                    ? ' arc-navbar-search--similar'
                    : ' arc-navbar-search--ai'
            }`}
          >
            <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
            {isAiMode ? (
              <>
                <input
                  ref={searchInputRef}
                  className="search-inner slot-value arc-navbar-search-inner-ai"
                  type="text"
                  placeholder={placeholder}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setFieldError(false);
                  }}
                  onKeyDown={onInputKeyDown}
                  onFocus={() => openPanel()}
                  onClick={() => openPanel()}
                />
                <div className="arc-navbar-search-actions slot-trailing">
                  {aiSearching ? (
                    <span className="loader arc-navbar-search-loader" role="status" aria-label="Поиск" />
                  ) : (
                    <>
                      {showAiClear ? (
                        <button
                          type="button"
                          className="input-inline-icon arc-navbar-search-clear-btn arc-icon-close"
                          aria-label="Сбросить поиск"
                          onClick={resetSearchField}
                        />
                      ) : null}
                      {showAiSend ? (
                        <button
                          type="button"
                          className="input-inline-icon arc-navbar-search-send-btn arc-icon-send"
                          aria-label="Запустить поиск"
                          onClick={() => applyAiQuery(draft)}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : isColorMode ? (
              <button
                type="button"
                className="arc-navbar-search-color-trigger slot-value"
                aria-label="Открыть поиск по цвету"
                onClick={() => openPanel()}
              >
                <span className="arc-navbar-search-color-hex-prefix">HEX</span>
                <span className="arc-navbar-search-color-hex-value">{displayColorHex}</span>
                <span
                  className="arc-navbar-search-color-swatch"
                  style={{ background: `#${displayColorHex}` }}
                  aria-hidden="true"
                />
              </button>
            ) : isSimilarMode ? (
              <>
                <button
                  type="button"
                  className="arc-navbar-search-similar-trigger slot-value"
                  aria-label="Открыть поиск по совпадениям"
                  onClick={() => openPanel()}
                >
                  {similarSearch.previewSrc ? (
                    <img
                      src={similarSearch.previewSrc}
                      alt=""
                      className="arc-navbar-search-similar-thumb"
                    />
                  ) : (
                    <span className="typo-p-m arc-navbar-search-similar-placeholder">{placeholder}</span>
                  )}
                </button>
                <div className="arc-navbar-search-actions slot-trailing">
                  {similarSearch.similarSearching ? (
                    <span className="loader arc-navbar-search-loader" role="status" aria-label="Поиск" />
                  ) : (
                    <>
                      {similarSearch.hasSimilarQuery ? (
                        <button
                          type="button"
                          className="input-inline-icon arc-navbar-search-clear-btn arc-icon-close"
                          aria-label="Сбросить поиск"
                          onClick={resetSearchField}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="input-inline-icon arc-navbar-search-send-btn arc-icon-search"
                        aria-label="Открыть поиск по совпадениям"
                        onClick={() => openPanel()}
                      />
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
            <div
              className="arc-navbar-search-scroll-clip"
              data-fade-start={scrollFade.start ? 'true' : undefined}
              data-fade-end={scrollFade.end ? 'true' : undefined}
            >
              <div
                ref={scrollTrackRef}
                className="arc-navbar-search-scroll"
                onWheel={onScrollTrackWheel}
              >
                <div className="arc-navbar-search-scroll__track">
                {selectedTagIds.map((id) => {
                      const t = tagsIndex.get(id);
                      const cat = t ? categoryById.get(t.categoryId) : undefined;
                      const color = cat?.colorHex ?? 'var(--gray-500)';
                      const count = t?.usageCount ?? 0;
                      const countLabel = count > 0 ? formatNavbarTabCount(count) : null;
                      const remove = () => removeTag(id);
                      return (
                        <span
                          key={id}
                          role="button"
                          tabIndex={0}
                          className="chip chip-active"
                          aria-label={`Снять метку ${t?.name ?? ''}`}
                          onClick={remove}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              remove();
                            }
                          }}
                        >
                          <span className="chip-color" style={{ background: color }} aria-hidden="true" />
                          <span>{t?.name ?? id.slice(0, 8)}</span>
                          {countLabel ? <span className="chip-count">{countLabel}</span> : null}
                          <span className="chip-remove" aria-hidden="true">
                            ✕
                          </span>
                        </span>
                      );
                    })}
                {cardIdFilter ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="chip chip-active"
                    aria-label="Сбросить фильтр по ID"
                    onClick={() => {
                      panelHadInteraction.current = true;
                      setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        panelHadInteraction.current = true;
                        setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                      }
                    }}
                  >
                    <span className="chip-color" style={{ background: 'var(--gray-300)' }} aria-hidden="true" />
                    <span>ID: {cardIdFilter.slice(0, 8)}…</span>
                    <span className="chip-remove" aria-hidden="true">
                      ✕
                    </span>
                  </span>
                ) : null}
                <input
                  ref={searchInputRef}
                  className="search-inner arc-navbar-search-inner"
                  type="text"
                  placeholder={placeholder}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setFieldError(false);
                    if (e.target.value.trim().length > 0) openPanel();
                  }}
                  onKeyDown={onInputKeyDown}
                  onFocus={() => {
                    openPanel();
                    ensureInputVisible();
                  }}
                  onClick={() => {
                    openPanel();
                    ensureInputVisible();
                  }}
                />
              </div>
            </div>
            </div>
            <button
              className="input-inline-icon search-multiselect-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
              type="button"
              aria-label="Сбросить поиск"
              onClick={resetSearchField}
            />
              </>
            )}
          </div>
        </div>
        </div>
      </div>

      {(isTagsMode || isAiMode || isColorMode || isSimilarMode) && panelOpen && dropdownLayout ? (
        <>
          <button
            type="button"
            className="arc-search-backdrop"
            aria-label="Закрыть поиск"
            onClick={closePanel}
          />
          <div
            className="arc-search-panel arc-ui-kit-scope"
            data-elevation="raised"
            data-typo-tone="white"
            style={{
              top: dropdownLayout.top,
              left: dropdownLayout.left,
              width: dropdownLayout.width
            }}
          >
            <div className="arc-add-tags-scroll arc-search-panel-scroll">
              <div className="arc-search-panel-stack">
                {isTagsMode ? (
                  <>
                    {!q ? (
                      <div className="arc-search-panel-intro">
                        <SearchPanelModeHeader mode={searchMode} />
                        <p className="text-m arc-search-panel-hint">{SEARCH_MODE_META.tags.panelHint}</p>
                      </div>
                    ) : (
                      <>
                        <SearchPanelModeHeader mode={searchMode} />
                        {rankedTags.length === 0 ? (
                          <p className="text-m arc-search-panel-hint arc-search-panel-suggest">
                            Нет совпадений по запросу.
                          </p>
                        ) : (
                          <div className="tags-row arc-search-tags-row arc-search-panel-suggest">
                            {rankedTags.map(({ tag, category }) => (
                              <SearchPanelTagChip
                                key={tag.id}
                                tag={tag}
                                category={category}
                                selected={selectedTagIds.includes(tag.id)}
                                highlightQuery={q}
                                onToggle={() => toggleTag(tag.id)}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {hasRecentSectionsTags ? <SearchPanelFullBleedSep /> : null}

                    {showRecentTags ? (
                      <SearchPanelSection
                        title="Недавние запросы"
                        onClear={() => {
                          clearAllRecentTagIds();
                          setRecentTick((x) => x + 1);
                        }}
                      >
                        <div className="tags-row arc-search-tags-row">
                          {recentIds.map((rid) => {
                            const t = tagsIndex.get(rid);
                            if (!t) return null;
                            const cat = categoryById.get(t.categoryId);
                            if (!cat) return null;
                            return (
                              <SearchPanelTagChip
                                key={rid}
                                tag={t}
                                category={cat}
                                selected={selectedTagIds.includes(rid)}
                                onToggle={() => toggleTag(rid)}
                                onRemoveFromRecent={() => {
                                  removeRecentTagId(rid);
                                  setRecentTick((x) => x + 1);
                                }}
                              />
                            );
                          })}
                        </div>
                      </SearchPanelSection>
                    ) : null}
                  </>
                ) : isAiMode ? (
                  <>
                    <div className="arc-search-panel-intro arc-search-panel-intro--ai">
                      <SearchPanelModeHeader mode="ai" />
                      <p className="text-m arc-search-panel-hint">{SEARCH_MODE_META.ai.panelHint}</p>
                    </div>

                    {hasRecentSectionsAi ? <SearchPanelFullBleedSep /> : null}

                    {showRecentAi ? (
                      <SearchPanelSection
                        title="Недавние запросы"
                        onClear={() => {
                          clearAllRecentAiQueries();
                          setRecentTick((x) => x + 1);
                        }}
                      >
                        <SearchPanelRecentQueries queries={recentAiIds} onSelect={selectRecentAiQuery} />
                      </SearchPanelSection>
                    ) : null}
                  </>
                ) : isColorMode ? (
                  <>
                    <SearchPanelColorControls
                      colorHex={panelColorHex}
                      tolerance={panelColorTolerance}
                      onColorChange={handlePanelColorChange}
                      onToleranceChange={handlePanelToleranceChange}
                    />

                    {hasRecentSectionsColor ? <SearchPanelFullBleedSep /> : null}
                  </>
                ) : (
                  <SearchPanelSimilarControls
                    crop={similarSearch.panelCrop}
                    hasQuery={similarSearch.hasSimilarQuery}
                    previewSrc={similarSearch.previewSrc}
                    onCropChange={similarSearch.onPanelCropChange}
                    onUploadStaged={similarSearch.setSimilarUploadQuery}
                    onClearQuery={similarSearch.clearSimilarQuery}
                    onConfirmSearch={closePanel}
                    onRecentClear={() => {
                      clearAllRecentViewedCardIds();
                      setRecentTick((x) => x + 1);
                    }}
                    recentViewedIds={recentViewedIds}
                    onSelectRecentCard={(id) => {
                      panelHadInteraction.current = true;
                      similarSearch.setSimilarCardQuery(id);
                    }}
                  />
                )}

                {showRecentViews && !isSimilarMode ? (
                  <>
                    {(isTagsMode ? showRecentTags : isAiMode ? showRecentAi : false) ? (
                      <SearchPanelFullBleedSep />
                    ) : null}
                    <SearchPanelSection
                      title="Недавние просмотры"
                      onClear={() => {
                        clearAllRecentViewedCardIds();
                        setRecentTick((x) => x + 1);
                      }}
                    >
                      <SearchPanelRecentCards cardIds={recentViewedIds} onSelect={selectRecentCard} />
                    </SearchPanelSection>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
      </div>
    </>
  );
}
