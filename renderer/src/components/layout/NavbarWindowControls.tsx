import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { useLayoutEffect, useRef } from 'react';

export default function NavbarWindowControls() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) void hydrateArcNavbarIcons(ref.current);
  }, []);

  const minimize = () => {
    void window.arc?.windowMinimizeToTray?.();
  };

  const toggleMaximize = () => {
    void window.arc?.windowToggleMaximize?.();
  };

  const close = () => {
    void window.arc?.windowCloseToTray?.();
  };

  return (
    <div ref={ref} className="arc-navbar-window-controls arc-navbar-no-drag">
      <button
        type="button"
        className="btn btn-ghost btn-ds btn-icon-only arc-navbar-window-btn"
        aria-label="Свернуть в трей"
        onClick={minimize}
      >
        <span className="btn-icon-only__glyph arc-icon-minimize" data-arc-icon-size="s" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-ds btn-icon-only arc-navbar-window-btn"
        aria-label="Развернуть окно"
        onClick={toggleMaximize}
      >
        <span className="btn-icon-only__glyph arc-icon-maximize" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-ds btn-icon-only arc-navbar-window-btn arc-navbar-window-btn--close"
        aria-label="Закрыть в трей"
        onClick={close}
      >
        <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
      </button>
    </div>
  );
}
