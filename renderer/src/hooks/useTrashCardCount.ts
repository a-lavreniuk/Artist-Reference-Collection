import { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ARC_CARDS_CHANGED_EVENT } from '../services/db';
import { parseLibraryScope } from '../search/libraryScopeUrl';
import { storageCountCards } from '../services/storageClient';

export function useTrashCardCount() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeScope = parseLibraryScope(searchParams);
  const isGalleryPage = location.pathname === '/gallery';
  const enabled = isGalleryPage && activeScope === 'trash';

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const n = await storageCountCards('all', 'trash');
      setCount(n);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onCardsChanged = () => void refresh();
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
    return () => window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
  }, [enabled, refresh]);

  return { count, loading, enabled };
}
