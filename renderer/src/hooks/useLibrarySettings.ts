import { useCallback, useEffect, useState } from 'react';
import {
  defaultDetailCardTemplate,
  sanitizeDetailCardTemplate,
  type DetailCardTemplateV1
} from '@arc-main-shared/detailCardTemplate';
import {
  defaultGalleryFilterLayout,
  type GalleryFilterLayoutState
} from '../components/gallery/galleryFilterTypes';
import * as storage from '../services/storageClient';

export const LIBRARY_SETTINGS_CHANGED_EVENT = 'arc:library-settings-changed';

export type LibrarySettingsState = {
  detailCardTemplate: DetailCardTemplateV1;
  systemFilterLayout: GalleryFilterLayoutState;
};

function fallbackSettings(): LibrarySettingsState {
  return {
    detailCardTemplate: defaultDetailCardTemplate(),
    systemFilterLayout: defaultGalleryFilterLayout()
  };
}

function parseSettingsPayload(raw: {
  detailCardTemplate: unknown;
  systemFilterLayout: unknown;
}): LibrarySettingsState {
  return {
    detailCardTemplate: sanitizeDetailCardTemplate(raw.detailCardTemplate),
    systemFilterLayout: raw.systemFilterLayout as GalleryFilterLayoutState
  };
}

export function useLibrarySettings() {
  const [settings, setSettings] = useState<LibrarySettingsState | null>(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback((next: LibrarySettingsState) => {
    setSettings(next);
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await storage.storageGetLibrarySettings();
      if (!next) {
        setSettings(fallbackSettings());
        setReady(false);
        return;
      }
      apply(parseSettingsPayload(next));
    } catch {
      setSettings(fallbackSettings());
      setReady(false);
    }
  }, [apply]);

  useEffect(() => {
    void reload();
    const onLib = () => void reload();
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<LibrarySettingsState>).detail;
      if (detail?.detailCardTemplate && detail.systemFilterLayout) {
        apply(detail);
        return;
      }
      void reload();
    };
    window.addEventListener('arc:library-changed', onLib);
    window.addEventListener(LIBRARY_SETTINGS_CHANGED_EVENT, onSettings);
    return () => {
      window.removeEventListener('arc:library-changed', onLib);
      window.removeEventListener(LIBRARY_SETTINGS_CHANGED_EVENT, onSettings);
    };
  }, [reload, apply]);

  const update = useCallback(
    async (patch: {
      detailCardTemplate?: DetailCardTemplateV1;
      systemFilterLayout?: GalleryFilterLayoutState;
    }) => {
      const nextRaw = await storage.storagePatchLibrarySettings(patch);
      const next = parseSettingsPayload(nextRaw);
      apply(next);
      window.dispatchEvent(new CustomEvent(LIBRARY_SETTINGS_CHANGED_EVENT, { detail: next }));
      return nextRaw;
    },
    [apply]
  );

  return {
    settings,
    ready,
    template: settings?.detailCardTemplate ?? defaultDetailCardTemplate(),
    layout: settings?.systemFilterLayout ?? defaultGalleryFilterLayout(),
    update,
    reload
  };
}
