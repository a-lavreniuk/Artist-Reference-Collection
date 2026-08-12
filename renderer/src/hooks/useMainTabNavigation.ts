import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveMainTab } from '../components/layout/navbarLayout';
import { parseDetailCardId, stripOpenCardFromParams } from '../search/openCardUrl';
import { beginManualSectionNavigation } from '../search/sectionNavigation';
import { parseLibraryScope, setLibraryScopeInParams } from '../search/libraryScopeUrl';

export function useMainTabNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeMainTab = resolveMainTab(location.pathname);

  return useCallback(
    (path: string) => {
      const hasOpenDetail = Boolean(parseDetailCardId(searchParams));
      const baseParams = hasOpenDetail
        ? stripOpenCardFromParams(searchParams)
        : new URLSearchParams(searchParams);

      let search = '';
      // Переход по вкладке всегда выводит из корзины, в том числе при возврате в библиотеку.
      if (activeMainTab === 'gallery' && parseLibraryScope(searchParams) !== 'all') {
        const nextParams = setLibraryScopeInParams(baseParams, 'all');
        const qs = nextParams.toString();
        search = qs ? `?${qs}` : '';
      }

      beginManualSectionNavigation();
      navigate({ pathname: path, search }, { replace: true });
    },
    [activeMainTab, navigate, searchParams]
  );
}
