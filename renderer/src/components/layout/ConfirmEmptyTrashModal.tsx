import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

const TRASH_CONFIRM_NAME = 'Очистить';

type Props = {
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmEmptyTrashModal({ onClose, onConfirm }: Props) {
  return (
    <ConfirmTypeToDeleteModal
      title="Очистить корзину?"
      message="Все карточки в корзине будут удалены навсегда вместе с файлами. Это действие не обратимо. Пожалуйста, введите «Очистить», чтобы подтвердить очистку."
      confirmName={TRASH_CONFIRM_NAME}
      confirmLabel="Очистить"
      busyConfirmLabel="Очистка…"
      titleId="arcEmptyTrashTitle"
      panelId="confirm-empty-trash-modal"
      hostClassName="arc-navbar-no-drag"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
