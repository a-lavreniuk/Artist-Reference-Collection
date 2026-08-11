import { useEffect, useState } from 'react';
import TagChipToggleWithTooltip from '../tags/TagChipToggleWithTooltip';
import TagPickerPanel from './TagPickerPanel';

const TAGS_PICKER_PANEL_ID = 'card-detail-tags-picker';

type Props = {
  selectedTagIds: string[];
  onClose: () => void;
  onToggleTag: (tagId: string) => void | Promise<void>;
};

export default function CardDetailTagsModal({ selectedTagIds, onClose, onToggleTag }: Props) {
  const [localSelectedTagIds, setLocalSelectedTagIds] = useState(selectedTagIds);

  useEffect(() => {
    setLocalSelectedTagIds(selectedTagIds);
  }, [selectedTagIds]);

  const handleToggleTag = (tagId: string) => {
    setLocalSelectedTagIds((prev) => {
      const has = prev.includes(tagId);
      return has ? prev.filter((id) => id !== tagId) : [...prev, tagId];
    });
    void onToggleTag(tagId);
  };

  return (
    <TagPickerPanel
      panelId={TAGS_PICKER_PANEL_ID}
      ariaLabel="Добавить метки"
      onClose={onClose}
      hydrateKey={localSelectedTagIds}
      onTagCreated={(tagId) => {
        if (!localSelectedTagIds.includes(tagId)) handleToggleTag(tagId);
      }}
      renderTagChip={(tag, cat) => (
        <TagChipToggleWithTooltip
          key={tag.id}
          tag={tag}
          categoryColorHex={cat.colorHex}
          selected={localSelectedTagIds.includes(tag.id)}
          onToggle={() => handleToggleTag(tag.id)}
        />
      )}
    />
  );
}
