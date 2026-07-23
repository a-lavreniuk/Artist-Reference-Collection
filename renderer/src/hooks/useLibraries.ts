import { useCallback, useEffect, useState } from 'react';

export type LibraryListItem = {
  id: string;
  name: string;
  path: string;
  active: boolean;
  cardCount?: number;
};

export function useLibraries() {
  const [libraries, setLibraries] = useState<LibraryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!window.arc?.listLibraries) {
      setLibraries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await window.arc.listLibraries();
      setLibraries(res.libraries ?? []);
    } catch {
      setLibraries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onLibraryChanged = () => void refresh();
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [refresh]);

  const activeLibrary = libraries.find((lib) => lib.active) ?? libraries[0] ?? null;

  return { libraries, activeLibrary, loading, refresh };
}
