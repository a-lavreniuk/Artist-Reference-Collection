import ConfirmTypeToDeleteModal from './ConfirmTypeToDeleteModal';

type Props = {
  collectionName: string;
  isSection?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmCollectionDeleteModal({
  collectionName,
  isSection = false,
  onClose,
  onConfirm
}: Props) {
  const entityGen = isSection ? 'раздела' : 'коллекции';
  return (
    <ConfirmTypeToDeleteModal
      title={isSection ? 'Удалить раздел?' : 'Удалить коллекцию?'}
      message={`Удаление ${entityGen} не затрагивает карточки — они останутся в галерее. Это действие не обратимо. Пожалуйста, введите название ${entityGen}, чтобы подтвердить удаление.`}
      confirmName={collectionName}
      titleId="arcDeleteCollectionTitle"
      panelId="confirm-delete-collection-modal"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
