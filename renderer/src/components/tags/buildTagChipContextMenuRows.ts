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
  onStartMultiSelect?: () => void;
  onShowInGallery?: () => void;
  onMoveToCategory: () => void;
  onMerge?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}): ContextMenuRow[] {
  const rows: ContextMenuRow[] = [];

  if (!actions.bulk && actions.onStartMultiSelect) {
    rows.push(
      itemRow('multi-select', 'Выбрать несколько', 'arc-icon-check-hexagon', actions.onStartMultiSelect)
    );
    rows.push({ type: 'separator', key: 'sep-multi' });
  }

  if (actions.onShowInGallery) {
    rows.push(
      itemRow(
        'gallery',
        actions.bulk ? 'Показать карточки по меткам' : 'Показать в галерее',
        'arc-icon-image',
        actions.onShowInGallery
      )
    );
  }

  rows.push(
    itemRow('move-category', 'Переместить в категорию…', 'arc-icon-folder-import', actions.onMoveToCategory)
  );

  if (actions.bulk && actions.onMerge) {
    rows.push(itemRow('merge', 'Объединить метки…', 'arc-icon-combine', actions.onMerge));
  }

  if (actions.onEdit) {
    rows.push(itemRow('edit', 'Редактировать', 'arc-icon-edit', actions.onEdit));
  }

  if (actions.onDelete) {
    rows.push({ type: 'separator', key: 'sep-danger' });
    rows.push(
      itemRow(
        'delete',
        actions.bulk ? 'Удалить метки' : 'Удалить метку',
        'arc-icon-trash',
        actions.onDelete
      )
    );
  }

  return rows;
}
