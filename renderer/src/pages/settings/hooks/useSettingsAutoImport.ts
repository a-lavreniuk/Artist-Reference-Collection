import { useCallback, useEffect, useState } from 'react';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { isLibraryConfigured } from '../../../services/db';

export function useSettingsAutoImport() {
  const { prefs, ready, update } = useAppPreferences();
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

  const disabled = !ready || !libraryReady || !window.arc || busy;
  const controlsDisabled = !ready || !libraryReady || !window.arc;
  const enabled = prefs?.autoImportEnabled === true;
  const folderPath = prefs?.autoImportFolderPath ?? null;
  const trashSourcesEnabled = prefs?.autoImportSourceFilesAction === 'trash';

  const pickFolder = useCallback(async (): Promise<string | null> => {
    if (!window.arc) return null;
    return window.arc.pickLibraryFolder();
  }, []);

  const setFolderPath = useCallback(
    async (path: string) => {
      setBusy(true);
      try {
        await update({ autoImportFolderPath: path });
      } finally {
        setBusy(false);
      }
    },
    [update]
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
        await update({ autoImportEnabled: false });
        return;
      }

      if (!folderPath) {
        const picked = await pickFolder();
        if (!picked) return;
        setBusy(true);
        try {
          await update({ autoImportEnabled: true, autoImportFolderPath: picked });
        } finally {
          setBusy(false);
        }
        return;
      }

      await update({ autoImportEnabled: true });
    },
    [disabled, folderPath, pickFolder, update]
  );

  const setTrashSourcesEnabled = useCallback(
    async (on: boolean) => {
      await update({ autoImportSourceFilesAction: on ? 'trash' : 'ask' });
    },
    [update]
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
    setEnabled,
    chooseFolder,
    setTrashSourcesEnabled
  };
}
