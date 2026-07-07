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
  bulk?: boolean;
  onShowInGallery?: () => void;
  onMoveToCategory: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}): ContextMenuRow[] {
  const rows: ContextMenuRow[] = [
    itemRow('move-category', 'Переместить в категорию…', 'arc-icon-chevrons-up-down', actions.onMoveToCategory)
  ];

  if (actions.onShowInGallery) {
    rows.unshift(itemRow('gallery', 'Показать в галерее', 'arc-icon-image', actions.onShowInGallery));
  }

  if (actions.onEdit) {
    rows.push(itemRow('edit', 'Редактировать', 'arc-icon-edit', actions.onEdit));
  }

  if (actions.onDelete) {
    rows.push({ type: 'separator', key: 'sep-danger' });
    rows.push(itemRow('delete', 'Удалить метку', 'arc-icon-trash', actions.onDelete));
  }

  return rows;
}
