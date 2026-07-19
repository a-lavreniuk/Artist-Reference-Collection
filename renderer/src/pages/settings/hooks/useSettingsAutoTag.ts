import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { isLibraryConfigured } from '../../../services/db';
import {
  getAiSettingsSnapshot,
  initAiSettingsSession,
  refreshAiSettings,
  subscribeAiSettings
} from '../settingsAiSession';

export function useSettingsAutoTag() {
  const { prefs, ready, update } = useAppPreferences();
  const [libraryReady, setLibraryReady] = useState(false);
  const aiSnapshot = useSyncExternalStore(subscribeAiSettings, getAiSettingsSnapshot, getAiSettingsSnapshot);

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

  useEffect(() => {
    initAiSettingsSession();
    void refreshAiSettings();
  }, []);

  const heavyInstalled = Boolean(
    aiSnapshot.status?.models.find((m) => m.tier === 'heavy')?.installed
  );

  const baseDisabled = !ready || !libraryReady || !window.arc;
  const enableDisabled = baseDisabled || !heavyInstalled;

  const enabled = prefs?.aiAutoTagEnabled === true;
  const volume = prefs?.aiAutoTagVolume ?? 50;
  const onImport = prefs?.aiAutoTagOnImport === true;
  const createNew = (prefs?.aiAutoTagCatalogMode ?? 'reuse') === 'reuse_create';

  const [videoCaptionOnImport, setVideoCaptionLocal] = useState(
    () => prefs?.aiVideoCaptionOnImport === true
  );

  useEffect(() => {
    if (!prefs) return;
    setVideoCaptionLocal(prefs.aiVideoCaptionOnImport === true);
  }, [prefs]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (enableDisabled && next) return;
      await update({ aiAutoTagEnabled: next });
    },
    [enableDisabled, update]
  );

  const setVolume = useCallback(
    async (next: number) => {
      if (baseDisabled) return;
      await update({ aiAutoTagVolume: next });
    },
    [baseDisabled, update]
  );

  const setOnImport = useCallback(
    async (next: boolean) => {
      if (baseDisabled) return;
      await update({ aiAutoTagOnImport: next });
    },
    [baseDisabled, update]
  );

  const setCreateNew = useCallback(
    async (next: boolean) => {
      if (baseDisabled) return;
      await update({ aiAutoTagCatalogMode: next ? 'reuse_create' : 'reuse' });
    },
    [baseDisabled, update]
  );

  const setVideoCaptionOnImport = useCallback(
    async (next: boolean) => {
      if (baseDisabled) return;
      setVideoCaptionLocal(next);
      await update({ aiVideoCaptionOnImport: next });
    },
    [baseDisabled, update]
  );

  return {
    ready,
    libraryReady,
    heavyInstalled,
    baseDisabled,
    enableDisabled,
    enabled,
    volume,
    onImport,
    createNew,
    videoCaptionOnImport,
    setEnabled,
    setVolume,
    setOnImport,
    setCreateNew,
    setVideoCaptionOnImport
  };
}
