import { useState } from 'react';
import ConfirmEmptyTrashModal from './ConfirmEmptyTrashModal';
import { emptyTrash } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';

const LABEL = 'Очистить корзину';

type Props = {
  disabled?: boolean;
};

/** Кнопка очистки корзины в шапке галереи. */
export default function NavbarTrashActions({ disabled = false }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-danger btn-ds btn-m"
        aria-label={LABEL}
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
      >
        <span className="btn-ds__value">{LABEL}</span>
      </button>
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
