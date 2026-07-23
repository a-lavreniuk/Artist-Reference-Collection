import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storageCountCards } from '../../services/storageClient';
import { ARC_CARDS_CHANGED_EVENT } from '../../services/db';
import ConfirmEmptyTrashModal from '../layout/ConfirmEmptyTrashModal';
import { emptyTrash } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';
import { parseLibraryScope, setLibraryScopeInParams } from '../../search/libraryScopeUrl';

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

type Props = {
  disabled?: boolean;
};

/** Кнопка «Очистить корзину» — только на экране галереи в режиме trash. */
export default function GalleryTrashToolbar({ disabled = false }: Props) {
  const [searchParams] = useSearchParams();
  const scope = parseLibraryScope(searchParams);
  const trashCount = useGlobalTrashCardCount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (scope !== 'trash' || trashCount <= 0) return null;

  return (
    <>
      <div className="arc-gallery-trash-toolbar arc-ui-kit-scope" data-btn-size="m">
        <button
          type="button"
          className="btn btn-outline btn-ds"
          aria-label="Очистить корзину"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
        >
          <span className="btn-ds__icon arc-icon-broom" aria-hidden="true" />
          <span className="btn-ds__value">Очистить корзину</span>
        </button>
      </div>
      {confirmOpen ? (
        <ConfirmEmptyTrashModal
          onClose={() => setConfirmOpen(false)}
          onConfirm={async () => {
            await emptyTrash();
            showAppNotification({
              message: 'Корзина очищена',
              variant: 'success',
              skipPrefCheck: true
            });
          }}
        />
      ) : null}
    </>
  );
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
