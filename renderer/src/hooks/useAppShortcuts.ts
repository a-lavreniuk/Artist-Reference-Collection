import { useCallback, useEffect } from 'react';
import { useArcHistoryNav } from '../components/layout/useArcHistoryNav';
import { useGridSize, type GridSize } from '../layout/gridSizePreference';
import { matchesShortcut } from '../shortcuts/matchShortcutEvent';
import { requestNavbarSearchFocus } from '../shortcuts/focusNavbarSearch';
import { isRendererShortcutBlocked } from '../shortcuts/shortcutGuards';
import type { ShortcutId } from '../shortcuts/shortcutRegistry';
import { useShortcutActions } from '../components/shortcuts/ShortcutActionContext';
import { useMainTabNavigation } from './useMainTabNavigation';
import { MAIN_NAV_TABS } from '../components/layout/navbarLayout';

const GRID_SHORTCUTS: Array<{ id: ShortcutId; size: GridSize }> = [
  { id: 'gallery.gridLarge', size: 'l' },
  { id: 'gallery.gridMedium', size: 'm' },
  { id: 'gallery.gridSmall', size: 's' }
];

const SECTION_SHORTCUTS: Array<{ id: ShortcutId; path: string }> = MAIN_NAV_TABS.map((tab) => ({
  id: `navigation.${tab.key}` as ShortcutId,
  path: tab.path
}));

const MAIN_FORWARDED_SHORTCUTS = new Set<ShortcutId>([
  'global.search',
  'global.import',
  'navigation.back',
  'navigation.forward',
  'navigation.gallery',
  'navigation.collections',
  'navigation.moodboard',
  'navigation.board'
]);

export function useAppShortcuts(): void {
  const { handlersRef } = useShortcutActions();
  const { goBack, goForward, canGoBack, canGoForward } = useArcHistoryNav();
  const navigateMainTab = useMainTabNavigation();
  const [, setGridSize] = useGridSize();

  const dispatchShortcut = useCallback(
    (id: ShortcutId) => {
      if (id === 'global.search') {
        requestNavbarSearchFocus();
        return;
      }

      if (id === 'global.import') {
        handlersRef.current.openImport?.();
        return;
      }

      if (id === 'navigation.back') {
        if (canGoBack) goBack();
        return;
      }

      if (id === 'navigation.forward') {
        if (canGoForward) goForward();
        return;
      }

      for (const entry of SECTION_SHORTCUTS) {
        if (entry.id === id) {
          navigateMainTab(entry.path);
          return;
        }
      }

      for (const entry of GRID_SHORTCUTS) {
        if (entry.id === id) {
          setGridSize(entry.size);
        }
      }
    },
    [canGoBack, canGoForward, goBack, goForward, handlersRef, navigateMainTab, setGridSize]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRendererShortcutBlocked(event)) return;

      if (matchesShortcut(event, 'global.search')) {
        event.preventDefault();
        dispatchShortcut('global.search');
        return;
      }

      if (matchesShortcut(event, 'global.import')) {
        const handler = handlersRef.current.openImport;
        if (!handler) return;
        event.preventDefault();
        handler();
        return;
      }

      if (matchesShortcut(event, 'navigation.back')) {
        if (!canGoBack) return;
        event.preventDefault();
        goBack();
        return;
      }

      if (matchesShortcut(event, 'navigation.forward')) {
        if (!canGoForward) return;
        event.preventDefault();
        goForward();
        return;
      }

      for (const entry of SECTION_SHORTCUTS) {
        if (matchesShortcut(event, entry.id)) {
          event.preventDefault();
          navigateMainTab(entry.path);
          return;
        }
      }

      for (const entry of GRID_SHORTCUTS) {
        if (matchesShortcut(event, entry.id)) {
          event.preventDefault();
          setGridSize(entry.size);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    const offRendererShortcut = window.arc?.onRendererShortcut?.((id) => {
      if (!MAIN_FORWARDED_SHORTCUTS.has(id as ShortcutId)) return;
      dispatchShortcut(id as ShortcutId);
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      offRendererShortcut?.();
    };
  }, [
    canGoBack,
    canGoForward,
    dispatchShortcut,
    goBack,
    goForward,
    handlersRef,
    navigateMainTab,
    setGridSize
  ]);
}
