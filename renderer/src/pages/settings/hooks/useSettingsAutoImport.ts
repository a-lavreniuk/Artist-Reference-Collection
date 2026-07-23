import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { useLibraries } from '../../../hooks/useLibraries';
import { isLibraryConfigured } from '../../../services/db';
import {
  resolveAutoImportForLibraryId,
  type AutoImportLibrarySettings
} from '../../../services/appPreferences';

function mergeAutoImportPatch(
  current: Record<string, AutoImportLibrarySettings>,
  libraryId: string,
  patch: AutoImportLibrarySettings
): Record<string, AutoImportLibrarySettings> {
  return {
    ...current,
    [libraryId]: {
      ...current[libraryId],
      ...patch
    }
  };
}

export function useSettingsAutoImport() {
  const { prefs, ready, update } = useAppPreferences();
  const { activeLibrary } = useLibraries();
  const libraryId = activeLibrary?.id ?? null;
  const [libraryReady, setLibraryReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLibraryReady(await isLibraryConfigured());
    })();
    const onLibraryChanged = () => {
      void (async () => setLibraryReady(await isLibraryConfigured()))();
    };
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, []);

  const activeAutoImport = useMemo(() => {
    if (!prefs || !libraryId) {
      return { enabled: false, folderPath: null as string | null, sourceFilesAction: 'ask' as const };
    }
    return resolveAutoImportForLibraryId(prefs, libraryId);
  }, [libraryId, prefs]);

  const patchActiveAutoImport = useCallback(
    async (patch: AutoImportLibrarySettings) => {
      if (!libraryId || !prefs) return;
      await update({
        autoImportByLibraryId: mergeAutoImportPatch(prefs.autoImportByLibraryId ?? {}, libraryId, patch)
      });
    },
    [libraryId, prefs, update]
  );

  const disabled = !ready || !libraryReady || !window.arc || busy || !libraryId;
  const controlsDisabled = !ready || !libraryReady || !window.arc || !libraryId;
  const enabled = activeAutoImport.enabled === true;
  const folderPath = activeAutoImport.folderPath ?? null;
  const trashSourcesEnabled = activeAutoImport.sourceFilesAction === 'trash';

  const pickFolder = useCallback(async (): Promise<string | null> => {
    if (!window.arc) return null;
    return window.arc.pickLibraryFolder();
  }, []);

  const setFolderPath = useCallback(
    async (path: string) => {
      setBusy(true);
      try {
        await patchActiveAutoImport({ folderPath: path });
      } finally {
        setBusy(false);
      }
    },
    [patchActiveAutoImport]
  );

  const chooseFolder = useCallback(async () => {
    if (disabled) return;
    const picked = await pickFolder();
    if (!picked) return;
    await setFolderPath(picked);
  }, [disabled, pickFolder, setFolderPath]);

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (disabled && nextEnabled) return;

      if (!nextEnabled) {
        await patchActiveAutoImport({ enabled: false });
        return;
      }

      if (!folderPath) {
        const picked = await pickFolder();
        if (!picked) return;
        setBusy(true);
        try {
          await patchActiveAutoImport({ enabled: true, folderPath: picked });
        } finally {
          setBusy(false);
        }
        return;
      }

      await patchActiveAutoImport({ enabled: true });
    },
    [disabled, folderPath, patchActiveAutoImport, pickFolder]
  );

  const setTrashSourcesEnabled = useCallback(
    async (on: boolean) => {
      await patchActiveAutoImport({ sourceFilesAction: on ? 'trash' : 'ask' });
    },
    [patchActiveAutoImport]
  );

  return {
    ready,
    libraryReady,
    disabled,
    controlsDisabled,
    busy,
    enabled,
    folderPath,
    trashSourcesEnabled,
    activeLibraryName: activeLibrary?.name ?? null,
    setEnabled,
    chooseFolder,
    setTrashSourcesEnabled
  };
}
