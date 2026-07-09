import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ARC_DETAIL_QUERY_CARD } from '../../../../search/openCardUrl';
import { setSearchAiInParams, setSearchColorInParams } from '../../../../search/searchUrl';
import { clearGallerySearchParams } from '../../../../search/clearGallerySearch';
import { clearSimilarUploadPath } from '../../../../search/similarSearchSession';
import { writeNavbarSearchMode, type NavbarSearchMode } from '../../../../search/navbarSearchMode';
import { useGalleryFilters } from '../../../gallery/GalleryFilterContext';
import {
  COLOR_SEARCH_PRESETS,
  DEFAULT_COLOR_SEARCH_TOLERANCE
} from '../../../../search/colorPresets';
import { buildModeChangeParams } from '../utils/searchUrlCommit';

export function useNavbarSearchUrl() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clearFilters } = useGalleryFilters();

  const isCardHostRoute =
    location.pathname === '/gallery' ||
    location.pathname.startsWith('/collections') ||
    location.pathname.startsWith('/moodboard');

  const navigateToSearchHost = useCallback(
    (nextParams?: URLSearchParams) => {
      if (location.pathname.startsWith('/collections') || location.pathname.startsWith('/moodboard')) {
        return;
      }
      if (location.pathname === '/gallery') {
        return;
      }
      const s = (nextParams ?? searchParams).toString();
      navigate({ pathname: '/gallery', search: s ? `?${s}` : '' });
    },
    [location.pathname, navigate, searchParams]
  );

  const commitGallerySearchParams = useCallback(
    (updater: (prev: URLSearchParams) => URLSearchParams, options?: { replace?: boolean }) => {
      const next = updater(searchParams);
      if (isCardHostRoute) {
        setSearchParams(next, { replace: options?.replace ?? true });
        return;
      }
      // На non-card страницах (board/tags/settings/...) не уводим пользователя в галерею
      // из фоновой синхронизации navbar search.
      setSearchParams(next, { replace: options?.replace ?? true });
    },
    [isCardHostRoute, location.pathname, searchParams, setSearchParams]
  );

  const resetSearchField = useCallback(() => {
    clearSimilarUploadPath();
    const n = clearGallerySearchParams(searchParams);
    n.delete(ARC_DETAIL_QUERY_CARD);
    setSearchParams(n, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleModeChange = useCallback(
    (
      mode: NavbarSearchMode,
      currentMode: NavbarSearchMode,
      callbacks: {
        setSearchMode: (mode: NavbarSearchMode) => void;
        setPanelColorHex: (hex: string) => void;
        setPanelColorTolerance: (tol: number) => void;
        setDraft: (v: string) => void;
        setFieldError: (v: boolean) => void;
        setPanelOpen: (v: boolean) => void;
      }
    ) => {
      if (mode === currentMode) return;
      callbacks.setSearchMode(mode);
      writeNavbarSearchMode(mode);
      clearFilters();
      clearSimilarUploadPath();
      const next = buildModeChangeParams(searchParams, mode);
      if (mode === 'color') {
        callbacks.setPanelColorHex(COLOR_SEARCH_PRESETS[1].hex);
        callbacks.setPanelColorTolerance(DEFAULT_COLOR_SEARCH_TOLERANCE);
      }
      setSearchParams(next, { replace: true });
      callbacks.setDraft('');
      callbacks.setFieldError(false);
    },
    [clearFilters, searchParams, setSearchParams]
  );

  const applyAiQueryToParams = useCallback(
    (query: string) => {
      return commitGallerySearchParams((prev) => {
        const base = clearGallerySearchParams(prev);
        return setSearchAiInParams(base, query);
      });
    },
    [commitGallerySearchParams]
  );

  const applyColorSearch = useCallback(
    (hex: string, tolerance: number) => {
      commitGallerySearchParams((prev) => {
        const base = clearGallerySearchParams(prev);
        return setSearchColorInParams(base, hex, tolerance);
      });
    },
    [commitGallerySearchParams]
  );

  return {
    searchParams,
    setSearchParams,
    commitGallerySearchParams,
    resetSearchField,
    handleModeChange,
    applyAiQueryToParams,
    applyColorSearch
  };
}
