import type { ContextMenuRow } from '../../context-menu';
import { DEFAULT_CONTEXT_MENU_SLOT_ORDER } from '../../context-menu';

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

export function buildFilterPresetContextMenuRows(actions: {
  onApply: () => void;
  onRename: () => void;
  onDelete: () => void;
}): ContextMenuRow[] {
  return [
    itemRow('apply', 'Применить', 'arc-icon-check', actions.onApply),
    itemRow('rename', 'Переименовать', 'arc-icon-edit', actions.onRename),
    { type: 'separator', key: 'sep-danger' },
    itemRow('delete', 'Удалить', 'arc-icon-trash', actions.onDelete)
  ];
}
