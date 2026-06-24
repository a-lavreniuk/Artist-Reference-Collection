import type { ContextMenuRow } from '../context-menu';
import { DEFAULT_CONTEXT_MENU_SLOT_ORDER } from '../context-menu';

const ITEM_SLOTS = DEFAULT_CONTEXT_MENU_SLOT_ORDER;

function itemRow(
  key: string,
  label: string,
  iconClass: string | undefined,
  onSelect: () => void
): ContextMenuRow {
  return {
    type: 'item',
    key,
    label,
    iconClass,
    slotOrder: ITEM_SLOTS,
    onSelect
  };
}

export function buildMoodboardQueueContextMenuRows(actions: {
  onOpen: () => void;
  onRemoveFromMoodboard: () => void;
}): ContextMenuRow[] {
  return [
    itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
    { type: 'separator', key: 'sep-danger' },
    itemRow('remove', 'Снять с мудборда', 'arc-icon-bookmark-minus', actions.onRemoveFromMoodboard)
  ];
}
