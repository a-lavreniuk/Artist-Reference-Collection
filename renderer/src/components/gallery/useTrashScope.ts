import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storageCountCards } from '../../services/storageClient';
import { ARC_CARDS_CHANGED_EVENT } from '../../services/db';
import { setLibraryScopeInParams } from '../../search/libraryScopeUrl';

export function useGlobalTrashCardCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const n = await storageCountCards('all', 'trash');
      setCount(n);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onCardsChanged = () => void refresh();
    const onLibraryChanged = () => void refresh();
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCardsChanged);
      window.removeEventListener('arc:library-changed', onLibraryChanged);
    };
  }, [refresh]);

  return count;
}

export function useNavigateToTrashGallery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useCallback(() => {
    const nextParams = setLibraryScopeInParams(searchParams, 'trash');
    const search = nextParams.toString();
    navigate({ pathname: '/gallery', search: search ? `?${search}` : '' });
  }, [navigate, searchParams]);
}
