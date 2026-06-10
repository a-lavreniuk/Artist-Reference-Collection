import { useEffect, useState } from 'react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../context-menu';
import {
  CARD_SETTINGS_FIELDS,
  CARD_SETTINGS_FIELD_LABELS,
  getLastCardSettingsFieldSelection,
  hasSelectedCardSettingsField,
  rememberCardSettingsFieldSelection,
  type CardSettingsFieldSelection
} from './cardSettingsClipboard';

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onCopy: (fields: CardSettingsFieldSelection) => void;
};

export default function CopyCardSettingsMenu({ open, anchorRef, onClose, onCopy }: Props) {
  const [selection, setSelection] = useState<CardSettingsFieldSelection>(getLastCardSettingsFieldSelection);

  useEffect(() => {
    if (open) {
      setSelection(getLastCardSettingsFieldSelection());
    }
  }, [open]);

  const toggleField = (field: keyof CardSettingsFieldSelection) => {
    setSelection((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCopy = () => {
    if (!hasSelectedCardSettingsField(selection)) return;
    rememberCardSettingsFieldSelection(selection);
    onCopy(selection);
    onClose();
  };

  return (
    <ContextMenu open={open} anchorRef={anchorRef} onClose={onClose} ariaLabel="Копировать настройки">
      {CARD_SETTINGS_FIELDS.map((field) => (
        <ContextMenuItem
          key={field}
          label={CARD_SETTINGS_FIELD_LABELS[field]}
          selected={selection[field]}
          onSelect={() => toggleField(field)}
        />
      ))}
      <ContextMenuSeparator />
      <ContextMenuItem
        label="Копировать"
        disabled={!hasSelectedCardSettingsField(selection)}
        onSelect={handleCopy}
      />
    </ContextMenu>
  );
}
