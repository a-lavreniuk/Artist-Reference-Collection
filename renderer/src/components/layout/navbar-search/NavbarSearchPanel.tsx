import { useEffect, useRef, useState } from 'react';
import { useNavbarSearch } from './NavbarSearchContext';
import NavbarSearchPanelPortal from './NavbarSearchPanelPortal';
import { NAVBAR_SEARCH_MODES } from './modes/registry';
import type { NavbarSearchMode } from '../../../search/navbarSearchMode';
import type { NavbarSearchContextValue } from './types';

const MODE_TRANSITION_MS = 250;

function renderModePanel(mode: NavbarSearchMode, ctx: NavbarSearchContextValue) {
  const PanelContent = NAVBAR_SEARCH_MODES[mode].PanelContent;
  return <PanelContent ctx={{ ...ctx, searchMode: mode }} />;
}

/** Смена режима: fade-out → swap → fade-in (один слой, без наложения двух панелей). */
function SearchPanelModeTransition({ ctx }: { ctx: NavbarSearchContextValue }) {
  const mode = ctx.searchMode;
  const [displayMode, setDisplayMode] = useState(mode);
  const [visible, setVisible] = useState(true);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetModeRef = useRef(mode);

  useEffect(() => {
    targetModeRef.current = mode;
    if (mode === displayMode) {
      if (swapTimerRef.current) {
        clearTimeout(swapTimerRef.current);
        swapTimerRef.current = null;
      }
      setVisible(true);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayMode(mode);
      setVisible(true);
      return;
    }

    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);

    setVisible(false);
    const half = MODE_TRANSITION_MS / 2;
    swapTimerRef.current = setTimeout(() => {
      swapTimerRef.current = null;
      setDisplayMode(targetModeRef.current);
      requestAnimationFrame(() => setVisible(true));
    }, half);

    return () => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    };
  }, [mode, displayMode]);

  return (
    <div
      className={`arc-search-panel-mode-transition${visible ? ' arc-search-panel-mode-transition--visible' : ''}`}
    >
      {renderModePanel(displayMode, ctx)}
    </div>
  );
}

export default function NavbarSearchPanel() {
  const ctx = useNavbarSearch();

  return (
    <NavbarSearchPanelPortal
      open={ctx.panelOpen}
      layout={ctx.dropdownLayout}
      searchMode={ctx.searchMode}
      onClose={ctx.closePanel}
    >
      <div className="arc-add-tags-scroll arc-search-panel-scroll">
        <SearchPanelModeTransition ctx={ctx} />
      </div>
    </NavbarSearchPanelPortal>
  );
}
