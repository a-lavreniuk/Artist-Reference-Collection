import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

type Props = {
  libraryName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmDeleteLibraryModal({ libraryName, onClose, onConfirm }: Props) {
  return (
    <ConfirmTypeToDeleteModal
      title="Удалить библиотеку?"
      message="Удаление библиотеки сотрёт её папку и все файлы на диске. Это действие не обратимо. Пожалуйста, введите название библиотеки, чтобы подтвердить удаление."
      confirmName={libraryName}
      titleId="arcDeleteLibraryTitle"
      panelId="confirm-delete-library-modal"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
