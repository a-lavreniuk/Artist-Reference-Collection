import { useCallback, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { NAVBAR_SEARCH_EXPANDED_WIDTH_PX } from '../../navbarLayout';
import {
  COLLAPSED_ISLAND_LAYOUT,
  computeCollapsedIslandWidth,
  resolveIslandExpanded,
  resolveIslandWidthCss
} from '../utils/islandWidth';

type UseNavbarSearchIslandWidthOptions = {
  panelOpen: boolean;
  hasValue: boolean;
  searchIslandWidePinned: boolean;
  searchMode: string;
  aiNavbarModesVisible: boolean;
  getSearchIsland: () => HTMLElement | null;
  measureRef: RefObject<HTMLSpanElement | null>;
};

export function useNavbarSearchIslandWidth({
  panelOpen,
  hasValue,
  searchIslandWidePinned,
  searchMode,
  aiNavbarModesVisible,
  getSearchIsland,
  measureRef
}: UseNavbarSearchIslandWidthOptions) {
  const [collapsedWidth, setCollapsedWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const island = getSearchIsland();
    const measureEl = measureRef.current;
    if (!island || !measureEl) return;

    const syncIslandWidth = () => {
      const modesWidth =
        island.querySelector('.arc-navbar-search-modes')?.getBoundingClientRect().width ??
        COLLAPSED_ISLAND_LAYOUT.defaultModesWidth;
      const collapsed = computeCollapsedIslandWidth({
        modesWidth,
        placeholderWidth: measureEl.offsetWidth
      });
      setCollapsedWidth(collapsed);
      island.style.setProperty('--arc-navbar-search-collapsed-width', `${collapsed}px`);

      const isWide = resolveIslandExpanded({
        panelOpen,
        hasValue,
        searchIslandWidePinned,
        searchMode
      });
      island.classList.toggle('is-expanded', isWide);
      island.style.setProperty(
        '--arc-navbar-search-island-width',
        resolveIslandWidthCss(isWide, collapsed, NAVBAR_SEARCH_EXPANDED_WIDTH_PX)
      );
    };

    syncIslandWidth();
    const ro = new ResizeObserver(syncIslandWidth);
    ro.observe(measureEl);
    const modesEl = island.querySelector('.arc-navbar-search-modes');
    if (modesEl) ro.observe(modesEl);
    return () => ro.disconnect();
  }, [panelOpen, hasValue, searchIslandWidePinned, searchMode, aiNavbarModesVisible, getSearchIsland, measureRef]);

  return collapsedWidth;
}

export function useNavbarSearchChipsScroll(
  scrollTrackRef: RefObject<HTMLDivElement | null>,
  searchInputRef: RefObject<HTMLInputElement | null>,
  deps: unknown[]
) {
  const [scrollFade, setScrollFade] = useState({ start: false, end: false });

  const syncScrollFade = useCallback(() => {
    const track = scrollTrackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const overflow = scrollWidth > clientWidth + 1;
    setScrollFade({
      start: overflow && scrollLeft > 1,
      end: overflow && scrollLeft + clientWidth < scrollWidth - 1
    });
  }, [scrollTrackRef]);

  const scrollChipsToEnd = useCallback(() => {
    const viewport = scrollTrackRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    syncScrollFade();
  }, [scrollTrackRef, syncScrollFade]);

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
  }, [scrollTrackRef, searchInputRef, syncScrollFade]);

  const onScrollTrackWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const track = scrollTrackRef.current;
      if (!track || track.scrollWidth <= track.clientWidth + 1) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    [scrollTrackRef]
  );

  useLayoutEffect(() => {
    scrollChipsToEnd();
  }, [scrollChipsToEnd, ...deps]);

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
  }, [scrollTrackRef, syncScrollFade, ...deps]);

  return {
    scrollFade,
    syncScrollFade,
    scrollChipsToEnd,
    ensureInputVisible,
    onScrollTrackWheel
  };
}
