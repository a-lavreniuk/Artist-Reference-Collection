import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { computePanelLayout } from '../utils/panelLayout';
import type { NavbarSearchPanelLayout } from '../NavbarSearchPanelPortal';

type UseNavbarSearchPanelOptions = {
  panelOpen: boolean;
  searchMode: string;
  getSearchIsland: () => HTMLElement | null;
  onClose: () => void;
  onPanelOpenChange?: (open: boolean) => void;
  detailCardId: string | null;
  setPanelOpen: (open: boolean) => void;
  setFieldError: (error: boolean) => void;
  layoutDeps: unknown[];
};

export function useNavbarSearchPanel({
  panelOpen,
  searchMode,
  getSearchIsland,
  onClose,
  onPanelOpenChange,
  detailCardId,
  setPanelOpen,
  setFieldError,
  layoutDeps
}: UseNavbarSearchPanelOptions) {
  const [dropdownLayout, setDropdownLayout] = useState<NavbarSearchPanelLayout | null>(null);

  const updateDropdownLayout = useCallback(() => {
    if (!panelOpen) return;
    const island = getSearchIsland();
    if (!island) return;
    const r = island.getBoundingClientRect();
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--s-2').trim();
    const gapBelowInput = Number.parseFloat(raw) || 8;
    setDropdownLayout(computePanelLayout(r, gapBelowInput));
  }, [panelOpen, getSearchIsland]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    updateDropdownLayout();
    const island = getSearchIsland();
    if (!island) return;
    const ro = new ResizeObserver(() => updateDropdownLayout());
    ro.observe(island);
    return () => ro.disconnect();
  }, [panelOpen, updateDropdownLayout, getSearchIsland, ...layoutDeps]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const onMove = () => updateDropdownLayout();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [panelOpen, updateDropdownLayout]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (document.querySelector('.arc-search-panel')?.contains(target)) return;
      if (getSearchIsland()?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [panelOpen, onClose, getSearchIsland]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, onClose]);

  useLayoutEffect(() => {
    onPanelOpenChange?.(panelOpen);
  }, [panelOpen, onPanelOpenChange]);

  useLayoutEffect(() => {
    if (!panelOpen) return undefined;
    document.body.classList.add('arc-search-panel-open');
    if (searchMode === 'similar') {
      document.body.classList.add('arc-similar-search-panel-open');
    }
    return () => {
      document.body.classList.remove('arc-search-panel-open');
      document.body.classList.remove('arc-similar-search-panel-open');
    };
  }, [panelOpen, searchMode]);

  useLayoutEffect(() => {
    if (!detailCardId) return;
    setPanelOpen(false);
    setFieldError(false);
  }, [detailCardId, setPanelOpen, setFieldError]);

  return { dropdownLayout, updateDropdownLayout };
}

export function useSearchIslandRef(
  islandRef: RefObject<HTMLDivElement | null>,
  searchAnchorRef: RefObject<HTMLDivElement | null>
) {
  return useCallback((): HTMLElement | null => {
    if (islandRef?.current) return islandRef.current;
    return searchAnchorRef.current?.closest('.arc-navbar-island--search') ?? null;
  }, [islandRef, searchAnchorRef]);
}
