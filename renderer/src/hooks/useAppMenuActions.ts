import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMainTabNavigation } from './useMainTabNavigation';

type AppMenuRendererAction =
  | { type: 'navigate'; path: string; deliveryId?: number }
  | { type: 'import-files'; paths: string[]; deliveryId?: number };

export const APP_MENU_IMPORT_FILES_EVENT = 'arc:app-menu-import-files';

let stashedMenuImportPaths: string[] | null = null;

export function stashAppMenuImportPaths(paths: string[]): void {
  stashedMenuImportPaths = paths;
}

export function takeStashedAppMenuImportPaths(): string[] | null {
  const paths = stashedMenuImportPaths;
  stashedMenuImportPaths = null;
  return paths;
}

function applyNavigate(
  path: string,
  navigate: ReturnType<typeof useNavigate>,
  navigateMainTab: (path: string) => void
): void {
  if (path.startsWith('/settings')) {
    navigate(path);
    return;
  }
  navigateMainTab(path);
}

export function useAppMenuActions(): void {
  const navigate = useNavigate();
  const navigateMainTab = useMainTabNavigation();
  const lastDeliveryIdRef = useRef(0);

  const apply = useCallback(
    (action: AppMenuRendererAction | null | undefined) => {
      if (!action) return;
      const deliveryId = action.deliveryId ?? 0;
      if (deliveryId > 0) {
        if (deliveryId <= lastDeliveryIdRef.current) return;
        lastDeliveryIdRef.current = deliveryId;
      }
      if (action.type === 'navigate') {
        applyNavigate(action.path, navigate, navigateMainTab);
        return;
      }
      stashAppMenuImportPaths(action.paths);
      window.dispatchEvent(new CustomEvent(APP_MENU_IMPORT_FILES_EVENT, { detail: action.paths }));
    },
    [navigate, navigateMainTab]
  );

  useEffect(() => {
    const off = window.arc?.onAppMenuAction?.((action) => {
      apply(action);
      void window.arc?.takePendingAppMenuAction?.();
    });
    void window.arc?.takePendingAppMenuAction?.().then((action) => apply(action));
    return () => off?.();
  }, [apply]);
}
