import { useMemo } from 'react';
import { filterCollectionPickerTree } from '@arc-main-shared/collectionHierarchy';
import type { CardRecord, CollectionRecord } from '../../services/db';
import CollectionPickerRow from './CollectionPickerRow';

type Props = {
  collections: CollectionRecord[];
  query: string;
  previews: Record<string, CardRecord[]>;
  counts: Record<string, number>;
  disabled?: boolean;
  isSelected: (collectionId: string) => boolean;
  isIndeterminate?: (collectionId: string) => boolean;
  onToggle: (collectionId: string) => void;
};

export function collectionPickerTreeHasRows(
  collections: readonly CollectionRecord[],
  query: string
): boolean {
  return filterCollectionPickerTree(collections, query).length > 0;
}

export default function CollectionPickerTree({
  collections,
  query,
  previews,
  counts,
  disabled,
  isSelected,
  isIndeterminate,
  onToggle
}: Props) {
  const rows = useMemo(
    () => filterCollectionPickerTree(collections, query),
    [collections, query]
  );

  return (
    <div className="arc-card-detail-collections-picker__list">
      {rows.map(({ item, nested }) => (
        <CollectionPickerRow
          key={item.id}
          collection={item}
          nested={nested}
          previews={previews[item.id] ?? []}
          count={counts[item.id] ?? 0}
          selected={isSelected(item.id)}
          indeterminate={isIndeterminate?.(item.id) ?? false}
          disabled={disabled}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}
