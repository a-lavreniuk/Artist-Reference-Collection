import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

const TRASH_CONFIRM_NAME = 'Корзина';

type Props = {
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmEmptyTrashModal({ onClose, onConfirm }: Props) {
  return (
    <ConfirmTypeToDeleteModal
      title="Очистить корзину?"
      message="Все карточки в корзине будут удалены навсегда вместе с файлами. Это действие не обратимо. Пожалуйста, введите «Корзина», чтобы подтвердить очистку."
      confirmName={TRASH_CONFIRM_NAME}
      confirmLabel="Очистить"
      busyConfirmLabel="Очистка…"
      titleId="arcEmptyTrashTitle"
      hostClassName="arc-navbar-no-drag"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
