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

export function buildTagChipContextMenuRows(actions: {
  onShowInGallery: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): ContextMenuRow[] {
  return [
    itemRow('gallery', 'Показать в галерее', 'arc-icon-image', actions.onShowInGallery),
    itemRow('edit', 'Редактировать', 'arc-icon-edit', actions.onEdit),
    { type: 'separator', key: 'sep-danger' },
    itemRow('delete', 'Удалить метку', 'arc-icon-trash', actions.onDelete)
  ];
}
