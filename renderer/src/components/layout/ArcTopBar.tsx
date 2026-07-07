import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { useArcHistoryNav } from './useArcHistoryNav';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import { useChromeTitle } from '../../hooks/useChromeTitle';

export default function ArcTopBar() {
  const ref = useRef<HTMLElement>(null);
  const { canGoBack, canGoForward, goBack, goForward } = useArcHistoryNav();
  const chromeTitle = useChromeTitle();

  useLayoutEffect(() => {
    if (ref.current) void hydrateArcNavbarIcons(ref.current);
  }, [canGoBack, canGoForward, chromeTitle]);

  const minimize = () => {
    void window.arc?.windowMinimizeToTray?.();
  };

  const toggleMaximize = () => {
    void window.arc?.windowToggleMaximize?.();
  };

  const closeToTray = getAppPreferencesSync().closeToTrayOnWindowClose;

  const close = () => {
    void window.arc?.windowCloseToTray?.();
  };

  return (
    <header ref={ref} className="arc-topbar arc-ui-kit-scope" data-elevation="default" data-typo-tone="white">
      <div className="arc-topbar__steps arc-navbar-no-drag">
        <button
          type="button"
          className="arc-topbar-btn"
          aria-label="Назад"
          disabled={!canGoBack}
          onClick={goBack}
        >
          <span
            className="arc-topbar-btn__glyph arc-icon-chevron arc-chevron-point-left"
            data-arc-icon-size="s"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="arc-topbar-btn"
          aria-label="Вперёд"
          disabled={!canGoForward}
          onClick={goForward}
        >
          <span
            className="arc-topbar-btn__glyph arc-icon-chevron arc-chevron-point-right"
            data-arc-icon-size="s"
            aria-hidden="true"
          />
        </button>
        <p className="arc-topbar__title text-s" title={chromeTitle}>
          {chromeTitle}
        </p>
      </div>

      <div className="arc-topbar__window arc-navbar-no-drag">
        <button type="button" className="arc-topbar-btn" aria-label="Свернуть в трей" onClick={minimize}>
          <span className="arc-topbar-btn__glyph arc-icon-minimize" data-arc-icon-size="s" aria-hidden="true" />
        </button>
        <button type="button" className="arc-topbar-btn" aria-label="Развернуть окно" onClick={toggleMaximize}>
          <span className="arc-topbar-btn__glyph arc-icon-maximize" data-arc-icon-size="s" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="arc-topbar-btn arc-topbar-btn--close"
          aria-label={closeToTray ? 'Закрыть в трей' : 'Закрыть приложение'}
          onClick={close}
        >
          <span className="arc-topbar-btn__glyph arc-icon-close" data-arc-icon-size="s" aria-hidden="true" />
        </button>
      </div>    </header>
  );
}
