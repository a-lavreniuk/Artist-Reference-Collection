import type { ContextMenuRow } from '../context-menu';
import { DEFAULT_CONTEXT_MENU_SLOT_ORDER } from '../context-menu';

const ITEM_SLOTS = DEFAULT_CONTEXT_MENU_SLOT_ORDER;

function itemRow(
  key: string,
  label: string,
  iconClass: string | undefined,
  onSelect: () => void,
  disabled = false
): ContextMenuRow {
  return {
    type: 'item',
    key,
    label,
    iconClass,
    slotOrder: ITEM_SLOTS,
    disabled,
    onSelect
  };
}

export function buildCollectionContextMenuRows(actions: {
  variant: 'collection' | 'section';
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddSection?: () => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onMerge?: () => void;
  canMove?: boolean;
  canMerge?: boolean;
}): ContextMenuRow[] {
  if (actions.variant === 'section') {
    return [
      itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
      itemRow('rename', 'Переименовать', 'arc-icon-edit', actions.onRename),
      itemRow('duplicate', 'Создать копию', 'arc-icon-copy', () => actions.onDuplicate?.()),
      itemRow('move', 'Переместить…', 'arc-icon-folder-import', () => actions.onMove?.(), !actions.canMove),
      itemRow('merge', 'Объединить…', 'arc-icon-combine', () => actions.onMerge?.(), !actions.canMerge),
      { type: 'separator', key: 'sep-danger' },
      itemRow('delete', 'Удалить раздел', 'arc-icon-trash', actions.onDelete)
    ];
  }

  return [
    itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
    itemRow('rename', 'Переименовать', 'arc-icon-edit', actions.onRename),
    itemRow('add-section', 'Новый раздел', 'arc-icon-folder-plus', () => actions.onAddSection?.()),
    { type: 'separator', key: 'sep-danger' },
    itemRow('delete', 'Удалить коллекцию', 'arc-icon-trash', actions.onDelete)
  ];
}
