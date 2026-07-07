import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

export default function OnboardingTopBar() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (ref.current) void hydrateArcNavbarIcons(ref.current);
  }, []);

  return (
    <header ref={ref} className="arc-topbar arc-ui-kit-scope arc-onboarding-topbar" data-elevation="default">
      <div className="arc-topbar__steps arc-navbar-no-drag" aria-hidden="true" />
      <div className="arc-topbar__window arc-navbar-no-drag">
        <button
          type="button"
          className="arc-topbar-btn"
          aria-label="Свернуть"
          onClick={() => void window.arc?.windowMinimizeToTray?.()}
        >
          <span className="arc-topbar-btn__glyph arc-icon-minimize" data-arc-icon-size="s" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="arc-topbar-btn arc-topbar-btn--close"
          aria-label="Закрыть"
          onClick={() => void window.arc?.windowCloseToTray?.()}
        >
          <span className="arc-topbar-btn__glyph arc-icon-close" data-arc-icon-size="s" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
