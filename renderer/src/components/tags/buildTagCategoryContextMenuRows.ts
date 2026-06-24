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

export function buildTagCategoryContextMenuRows(actions: {
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}): ContextMenuRow[] {
  return [
    itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
    itemRow('rename', 'Переименовать', 'arc-icon-edit', actions.onRename),
    { type: 'separator', key: 'sep-danger' },
    itemRow('delete', 'Удалить категорию', 'arc-icon-trash', actions.onDelete)
  ];
}
