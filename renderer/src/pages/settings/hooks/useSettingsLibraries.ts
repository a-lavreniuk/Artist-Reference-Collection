import { useCallback, useEffect, useState } from 'react';
import { invalidateLibraryCache } from '../../../services/db';
import type { LibraryListItem } from '../../../hooks/useLibraries';

export type LibraryManageModalState =
  | null
  | { mode: 'edit'; library: LibraryListItem };

export function useSettingsLibraries() {
  const [libraries, setLibraries] = useState<LibraryListItem[]>([]);
  const [containerName, setContainerName] = useState('Библиотека ARC');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<LibraryManageModalState>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.arc?.listLibraries) {
      setLibraries([]);
      return;
    }
    const [listRes, name, parent] = await Promise.all([
      window.arc.listLibraries(),
      window.arc.getLibraryContainerName?.() ?? Promise.resolve('Библиотека ARC'),
      window.arc.getParentLibraryPath?.() ?? Promise.resolve(null)
    ]);
    setLibraries(listRes.libraries ?? []);
    setContainerName(name || 'Библиотека ARC');
    setParentPath(parent);
  }, []);

  useEffect(() => {
    void refresh();
    const onLibraryChanged = () => void refresh();
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [refresh]);

  const notifyLibraryChanged = useCallback(async () => {
    invalidateLibraryCache();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    await refresh();
  }, [refresh]);

  const renameLibrary = useCallback(
    async (libraryId: string, name: string) => {
      if (!window.arc?.renameLibrary) return { ok: false as const };
      setBusy(true);
      try {
        const res = await window.arc.renameLibrary({ id: libraryId, name });
        if (res.ok) await notifyLibraryChanged();
        return res;
      } finally {
        setBusy(false);
      }
    },
    [notifyLibraryChanged]
  );

  const deleteLibrary = useCallback(
    async (libraryId: string, mode: 'disk' | 'unlink') => {
      if (!window.arc?.deleteLibrary) return { ok: false as const, error: 'Недоступно' };
      setBusy(true);
      try {
        const res = await window.arc.deleteLibrary({ id: libraryId, mode });
        if (res.ok) await notifyLibraryChanged();
        return res;
      } finally {
        setBusy(false);
      }
    },
    [notifyLibraryChanged]
  );

  /** Указать путь: контейнер, дочерняя библиотека или папка, в которой лежит «Библиотека ARC». */
  const pickLibraryLocation = useCallback(async () => {
    if (!window.arc?.pickLibraryFolder || !window.arc.openLibraryOrContainer) return;
    const picked = await window.arc.pickLibraryFolder();
    if (!picked) return;
    setBusy(true);
    try {
      const res = await window.arc.openLibraryOrContainer(picked);
      if (!res.ok) {
        setInfoModal(res.error?.trim() || 'Не удалось открыть выбранную папку');
        return;
      }
      await notifyLibraryChanged();
    } finally {
      setBusy(false);
    }
  }, [notifyLibraryChanged]);

  return {
    libraries,
    containerName,
    parentPath,
    busy,
    modal,
    setModal,
    infoModal,
    setInfoModal,
    renameLibrary,
    deleteLibrary,
    pickLibraryLocation,
    refresh
  };
}
