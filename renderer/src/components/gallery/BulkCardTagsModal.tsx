import { useEffect, useState } from 'react';
import type { CardRecord } from '../../services/db';
import BulkTagChip from '../tags/BulkTagChip';
import { resolveBulkTagState, type BulkTagState } from './galleryBulkActions';
import { pluralCardsRu } from './gallerySelectionCopy';
import TagPickerPanel from './TagPickerPanel';

const BULK_TAGS_PICKER_PANEL_ID = 'bulk-card-tags-picker';

type Props = {
  cardIds: readonly string[];
  cardsById: ReadonlyMap<string, CardRecord>;
  onClose: () => void;
  onToggleTag: (tagId: string, nextSelected: boolean) => Promise<void>;
  onCreateAndAssign: (tagId: string) => Promise<void>;
};

export default function BulkCardTagsModal({
  cardIds,
  cardsById,
  onClose,
  onToggleTag,
  onCreateAndAssign
}: Props) {
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [localStates, setLocalStates] = useState<Record<string, BulkTagState>>({});

  // Оптимистичные состояния живут только до обновления карточек в галерее.
  useEffect(() => {
    if (pendingTagId) return;
    setLocalStates((prev) => (Object.keys(prev).length > 0 ? {} : prev));
  }, [cardsById, pendingTagId]);

  const handleToggle = async (tagId: string, nextSelected: boolean) => {
    if (pendingTagId) return;
    setPendingTagId(tagId);
    setLocalStates((prev) => ({ ...prev, [tagId]: nextSelected ? 'all' : 'none' }));
    try {
      await onToggleTag(tagId, nextSelected);
    } catch {
      setLocalStates((prev) => {
        const next = { ...prev };
        delete next[tagId];
        return next;
      });
    } finally {
      setPendingTagId(null);
    }
  };

  return (
    <TagPickerPanel
      panelId={BULK_TAGS_PICKER_PANEL_ID}
      ariaLabel="Метки выбранных карточек"
      onClose={onClose}
      hydrateKey={localStates}
      contextNote={`Изменения применятся к ${cardIds.length} ${pluralCardsRu(cardIds.length)}`}
      onTagCreated={onCreateAndAssign}
      renderTagChip={(tag, cat) => (
        <BulkTagChip
          key={tag.id}
          tag={tag}
          categoryColorHex={cat.colorHex}
          state={localStates[tag.id] ?? resolveBulkTagState(cardIds, cardsById, tag.id)}
          disabled={pendingTagId !== null && pendingTagId !== tag.id}
          onToggle={(nextSelected) => void handleToggle(tag.id, nextSelected)}
        />
      )}
    />
  );
}
