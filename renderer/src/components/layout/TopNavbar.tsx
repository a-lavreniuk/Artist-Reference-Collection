import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavbarFiltersRow from './NavbarFiltersRow';
import NavbarLibrarySwitcher from './NavbarLibrarySwitcher';
import { useImportContext } from '../import/ImportContext';
import NavbarMenu from './NavbarMenu';
import NavbarGridSizeMenu from './NavbarGridSizeMenu';
import NavbarSearch from './NavbarSearch';
import NavbarShade from './NavbarShade';
import NavbarWindowControls from './NavbarWindowControls';
import { Tooltip } from '../tooltip/Tooltip';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { requestCloseCardDetail } from '../gallery/cardDetailEvents';
import {
  applyNavbarStackCssVars,
  applyNavbarTopBarLayoutVars,
  clearNavbarStackCssVars,
  MAIN_NAV_TABS,
  resolveMainTab,
  resolveNavbarVariant
} from './navbarLayout';

export default function TopNavbar() {
  const { openImportPicker } = useImportContext();
  const navigate = useNavigate();
  const location = useLocation();
  const hostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);

  const variant = useMemo(() => resolveNavbarVariant(location.pathname), [location.pathname]);
  const activeMainTab = useMemo(() => resolveMainTab(location.pathname), [location.pathname]);
  const showFiltersSection = variant === 'full' && filtersOpen;

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setMaintenanceLocked(v));
  }, []);

  useEffect(() => {
    if (variant !== 'full') {
      setFiltersOpen(false);
    }
  }, [variant]);

  useLayoutEffect(() => {
    if (headerRef.current) {
      void hydrateArcNavbarIcons(headerRef.current);
    }
  }, [variant, filtersOpen, activeMainTab, maintenanceLocked, location.pathname]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const syncMetrics = () => {
      applyNavbarStackCssVars(host, headerRef.current);
      applyNavbarTopBarLayoutVars(headerRef.current);
    };

    syncMetrics();

    const observer = new ResizeObserver(syncMetrics);
    observer.observe(host);
    const header = headerRef.current;
    if (header) {
      observer.observe(header);
      const topBar = header.querySelector('.arc-navbar-top-bar');
      const nav = header.querySelector('.arc-navbar-top-bar__nav');
      const mgmt = header.querySelector('.arc-navbar-top-bar__mgmt');
      if (topBar) observer.observe(topBar);
      if (nav) observer.observe(nav);
      if (mgmt) observer.observe(mgmt);
    }

    return () => {
      observer.disconnect();
      clearNavbarStackCssVars();
    };
  }, [variant, filtersOpen, activeMainTab, maintenanceLocked, location.pathname, location.search]);

  const handleMainTabClick = (path: string) => {
    if (maintenanceLocked) return;
    const nextTab = resolveMainTab(path);
    if (nextTab !== activeMainTab) {
      requestCloseCardDetail();
    }
    navigate(path);
  };

  return (
    <div ref={hostRef} className="arc-navbar-host">
      <NavbarShade filtersOpen={showFiltersSection} pauseBackdropBlur={searchPanelOpen} />
      <div className="arc-navbar-host__inner">
        <header
          ref={headerRef}
          className={`arc-navbar panel elevation-default${showFiltersSection ? ' arc-navbar--filters-open' : ''}`}
          data-elevation="default"
          data-navbar-elevation="default"
        >
          <div className="arc-navbar-top-bar">
            <div className="arc-navbar-top-bar__nav arc-navbar-no-drag">
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

            {variant === 'full' ? (
              <div className="arc-navbar-top-bar__search arc-navbar-no-drag">
                <Tooltip content="Размер сетки" delay={500} position="top">
                  <span className="arc-tooltip-anchor-inline">
                    <NavbarGridSizeMenu />
                  </span>
                </Tooltip>
                <button
                  type="button"
                  className={`btn btn-outline btn-ds btn-icon-only${filtersOpen ? ' is-active' : ''}`}
                  aria-label={filtersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
                  aria-pressed={filtersOpen}
                  disabled={maintenanceLocked}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  <span className="btn-icon-only__glyph arc-icon-filter" aria-hidden="true" />
                </button>
                <div className="arc-navbar-search-wrap">
                  <NavbarSearch onPanelOpenChange={setSearchPanelOpen} />
                </div>
                <Tooltip content="Добавить" delay={500} position="top">
                  <button
                    type="button"
                    className="btn btn-brand btn-ds btn-icon-only"
                    disabled={maintenanceLocked}
                    aria-label="Добавить"
                    onClick={openImportPicker}
                  >
                    <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div className="arc-navbar-top-bar__search arc-navbar-top-bar__search--spacer" aria-hidden="true" />
            )}

            <div
              className="arc-navbar-top-bar__mgmt arc-navbar-no-drag arc-ui-kit-scope"
              data-btn-size="s"
              data-elevation="default"
            >
              <NavbarLibrarySwitcher />
              <NavbarMenu />
              <NavbarWindowControls />
            </div>
          </div>

          {showFiltersSection ? (
            <>
              <hr className="arc-navbar-separator" aria-hidden="true" />
              <NavbarFiltersRow />
            </>
          ) : null}
        </header>
      </div>
    </div>
  );
}
