import { isCollectionSection } from '@arc-main-shared/collectionHierarchy';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { formatCardCountLabel } from '../../utils/formatCardCountLabel';
import ArcCheckbox from '../ui/ArcCheckbox';
import CardDetailCollectionStrip from './CardDetailCollectionStrip';

type Props = {
  collection: CollectionRecord;
  previews: CardRecord[];
  count: number;
  selected: boolean;
  indeterminate?: boolean;
  nested?: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export default function CollectionPickerRow({
  collection,
  previews,
  count,
  selected,
  indeterminate = false,
  nested = false,
  disabled,
  onToggle
}: Props) {
  const pressed = selected || indeterminate;
  const entity = isCollectionSection(collection) ? 'раздел' : 'коллекцию';
  return (
    <button
      type="button"
      className={`arc-card-detail-collection-row arc-card-detail-collection-row--picker panel elevation-sunken${nested ? ' arc-card-detail-collection-row--nested' : ''}`}
      aria-pressed={pressed}
      aria-label={`${selected ? 'Убрать из' : 'Добавить в'} ${entity} «${collection.name}»`}
      disabled={disabled}
      onClick={onToggle}
    >
      <CardDetailCollectionStrip collectionId={collection.id} previews={previews} />
      <div className="arc-card-detail-collection-main">
        <p className="text-l arc-card-detail-collection-name arc-card-detail-collection-name--picker">{collection.name}</p>
        <span className="text-s arc-card-detail-collection-picker-count">{formatCardCountLabel(count)}</span>
      </div>
      <ArcCheckbox
        checked={selected}
        indeterminate={indeterminate}
        className="arc-card-detail-collection-row__checkbox"
      />
    </button>
  );
}
