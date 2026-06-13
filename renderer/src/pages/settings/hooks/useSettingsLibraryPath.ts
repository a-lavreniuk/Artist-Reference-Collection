import { useCallback, useEffect, useState } from 'react';
import { getNavbarMetrics, invalidateLibraryCache } from '../../../services/db';

export function useSettingsLibraryPath() {
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [migrateTarget, setMigrateTarget] = useState<string | null>(null);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [oldFolderPath, setOldFolderPath] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.arc) {
      setLibraryPath(null);
      return;
    }
    setLibraryPath(await window.arc.getLibraryPath());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onLibraryChanged = () => void refresh();
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [refresh]);

  const chooseLibraryFolderFlow = useCallback(async () => {
    if (!window.arc) return;
    setFieldError(false);
    setMigrateError(null);
    const picked = await window.arc.pickLibraryFolder();
    if (!picked) return;

    const current = await window.arc.getLibraryPath();

    if (!current) {
      setBusy(true);
      try {
        const res = await window.arc.setLibraryPath(picked);
        if (!res.ok) {
          setFieldError(true);
          setInfoModal(res.error ?? 'Не удалось сохранить путь');
          return;
        }
        invalidateLibraryCache();
        await refresh();
        await getNavbarMetrics();
        window.dispatchEvent(new CustomEvent('arc:library-changed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    if (norm(picked) === norm(current)) {
      setMigrateError('Выберите другую папку — она совпадает с текущей библиотекой.');
      setInfoModal('Выберите другую папку — она совпадает с текущей библиотекой.');
      return;
    }

    const empty = await window.arc.dirIsEmpty(picked);
    if (!empty) {
      setMigrateError('Целевая папка должна быть пустой.');
      setInfoModal('Целевая папка должна быть пустой.');
      return;
    }
    setMigrateTarget(picked);
    setShowMigrateConfirm(true);
  }, [refresh]);

  const runMigrate = useCallback(async () => {
    if (!window.arc || !migrateTarget) return;
    setShowMigrateConfirm(false);
    setBusy(true);
    setMigrateError(null);
    try {
      const res = await window.arc.migrateLibrary(migrateTarget);
      if (!res.ok) {
        setMigrateError(res.error);
        setInfoModal(res.error);
        return;
      }
      invalidateLibraryCache();
      await refresh();
      await getNavbarMetrics();
      window.dispatchEvent(new CustomEvent('arc:library-changed'));
      setOldFolderPath(res.oldLibraryPath);
    } finally {
      setBusy(false);
      setMigrateTarget(null);
    }
  }, [migrateTarget, refresh]);

  const cancelMigrateConfirm = useCallback(() => {
    setShowMigrateConfirm(false);
    setMigrateTarget(null);
  }, []);

  const trashOldFolder = useCallback(async () => {
    if (!window.arc || !oldFolderPath) return;
    await window.arc.trashPath(oldFolderPath);
    setOldFolderPath(null);
  }, [oldFolderPath]);

  const openOldFolderInExplorer = useCallback(() => {
    if (oldFolderPath) void window.arc?.showAbsoluteInFolder(oldFolderPath);
    setOldFolderPath(null);
  }, [oldFolderPath]);

  return {
    libraryPath,
    busy,
    fieldError,
    migrateError,
    showMigrateConfirm,
    oldFolderPath,
    infoModal,
    setInfoModal,
    setOldFolderPath,
    chooseLibraryFolderFlow,
    runMigrate,
    cancelMigrateConfirm,
    trashOldFolder,
    openOldFolderInExplorer
  };
}
