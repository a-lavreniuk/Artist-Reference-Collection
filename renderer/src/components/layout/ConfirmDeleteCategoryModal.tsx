import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

type Props = {
  categoryName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmDeleteCategoryModal({ categoryName, onClose, onConfirm }: Props) {
  return (
    <ConfirmTypeToDeleteModal
      title="Удалить категорию?"
      message="Удаление категории приведёт к удалению всех привязанных к ней меток. Это действие не обратимо. Пожалуйста, введите название категории, чтобы подтвердить удаление."
      confirmName={categoryName}
      titleId="arcDeleteCategoryTitle"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
