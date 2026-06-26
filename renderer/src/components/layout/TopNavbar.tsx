import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import NavbarFiltersMenu from './navbar-filters/GalleryNavbarFilters';
import NavbarLibrarySwitcher from './NavbarLibrarySwitcher';
import { useImportContext } from '../import/ImportContext';
import NavbarMenu from './NavbarMenu';
import NavbarSearch from './NavbarSearch';
import NavbarShade from './NavbarShade';
import NavbarSortMenu from './NavbarSortMenu';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { requestCloseCardDetail } from '../gallery/cardDetailEvents';
import {
  applyNavbarIslandsLayoutVars,
  applyNavbarStackCssVars,
  clearNavbarStackCssVars,
  MAIN_NAV_TABS,
  resolveMainTab,
  resolveNavbarVariant
} from './navbarLayout';
import { parseLibraryScope, setLibraryScopeInParams } from '../../search/libraryScopeUrl';

export default function TopNavbar() {
  const { openImportPicker } = useImportContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const islandsRef = useRef<HTMLDivElement>(null);
  const searchIslandRef = useRef<HTMLDivElement>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);

  const variant = useMemo(
    () => resolveNavbarVariant(location.pathname, location.search),
    [location.pathname, location.search]
  );
  const activeMainTab = useMemo(() => resolveMainTab(location.pathname), [location.pathname]);
  const showSortAndFilters = variant === 'full';

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setMaintenanceLocked(v));
  }, []);

  useLayoutEffect(() => {
    if (islandsRef.current) {
      void hydrateArcNavbarIcons(islandsRef.current);
    }
  }, [activeMainTab, maintenanceLocked, location.pathname, location.search, searchPanelOpen, variant]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const syncMetrics = () => {
      applyNavbarStackCssVars(host, islandsRef.current);
      applyNavbarIslandsLayoutVars(host);
    };

    syncMetrics();

    const observer = new ResizeObserver(syncMetrics);
    observer.observe(host);
    const islands = islandsRef.current;
    if (islands) {
      observer.observe(islands);
      const nav = islands.querySelector('.arc-navbar-island--nav');
      const search = islands.querySelector('.arc-navbar-island--search');
      const mgmt = islands.querySelector('.arc-navbar-island--mgmt');
      if (nav) observer.observe(nav);
      if (search) observer.observe(search);
      if (mgmt) observer.observe(mgmt);
    }

    return () => {
      observer.disconnect();
      clearNavbarStackCssVars();
    };
  }, [activeMainTab, maintenanceLocked, location.pathname, location.search, searchPanelOpen, variant]);

  const handleMainTabClick = (path: string) => {
    if (maintenanceLocked) return;
    const nextTab = resolveMainTab(path);
    if (nextTab !== activeMainTab) {
      requestCloseCardDetail();
    }
    const leavingGallery = activeMainTab === 'gallery' && !path.startsWith('/gallery');
    if (leavingGallery && parseLibraryScope(searchParams) !== 'all') {
      const nextParams = setLibraryScopeInParams(searchParams, 'all');
      const search = nextParams.toString();
      navigate({ pathname: path, search: search ? `?${search}` : '' });
      return;
    }
    navigate(path);
  };

  return (
    <div ref={hostRef} className="arc-navbar-host">
      <NavbarShade pauseBackdropBlur={searchPanelOpen} />
      <div className="arc-navbar-host__inner">
        <div
          ref={islandsRef}
          className="arc-navbar-islands arc-navbar-no-drag arc-ui-kit-scope"
          data-btn-size="m"
        >
          <div className="arc-navbar-island arc-navbar-island--nav">
            <div className="tabs arc-navbar-main-tabs" role="tablist" aria-label="Основная навигация">
              {MAIN_NAV_TABS.map((tab) => {
                const isActive = tab.key === activeMainTab;
                return (
                  <button
                    key={tab.key}
                    className={`tab-button${isActive ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    disabled={maintenanceLocked}
                    onClick={() => handleMainTabClick(tab.path)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={searchIslandRef}
            className="arc-navbar-island arc-navbar-island--search"
          >
            <NavbarSearch islandRef={searchIslandRef} onPanelOpenChange={setSearchPanelOpen} />
          </div>

          <div className="arc-navbar-island arc-navbar-island--mgmt">
            {showSortAndFilters ? (
              <>
                <NavbarSortMenu disabled={maintenanceLocked} />
                <NavbarFiltersMenu />
              </>
            ) : null}
            <NavbarLibrarySwitcher disabled={maintenanceLocked} />
            <button
              type="button"
              className="btn btn-brand btn-ds btn-m"
              disabled={maintenanceLocked}
              onClick={openImportPicker}
            >
              Добавить
            </button>
            <NavbarMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
