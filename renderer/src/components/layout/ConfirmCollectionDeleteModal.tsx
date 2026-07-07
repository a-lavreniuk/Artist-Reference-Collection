import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

type Props = {
  collectionName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmCollectionDeleteModal({ collectionName, onClose, onConfirm }: Props) {
  return (
    <ConfirmTypeToDeleteModal
      title="Удалить коллекцию?"
      message="Удаление коллекции не затрагивает карточки — они останутся в галерее. Это действие не обратимо. Пожалуйста, введите название коллекции, чтобы подтвердить удаление."
      confirmName={collectionName}
      titleId="arcDeleteCollectionTitle"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
