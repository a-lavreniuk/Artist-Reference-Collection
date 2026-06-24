import type { ContextMenuRow } from '../context-menu';
import { DEFAULT_CONTEXT_MENU_SLOT_ORDER } from '../context-menu';
import type { BuildCardContextMenuRowsInput } from './cardContextMenuTypes';

const ITEM_SLOTS = DEFAULT_CONTEXT_MENU_SLOT_ORDER;

function itemRow(
  key: string,
  label: string,
  iconClass: string | undefined,
  onSelect: () => void,
  options?: { disabled?: boolean }
): ContextMenuRow {
  return {
    type: 'item',
    key,
    label,
    iconClass,
    slotOrder: ITEM_SLOTS,
    disabled: options?.disabled,
    onSelect
  };
}

function trashMenuRows(input: BuildCardContextMenuRowsInput): ContextMenuRow[] {
  const { actions, hasSourcePath } = input;
  return [
    itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
    itemRow('restore', 'Восстановить', 'arc-icon-undo', () => actions.onRestore?.()),
    itemRow('open-folder', 'Открыть папку исходника', 'arc-icon-folder-open', actions.onOpenSourceFolder, {
      disabled: !hasSourcePath
    }),
    { type: 'separator', key: 'sep-danger' },
    itemRow('permanent-delete', 'Удалить навсегда', 'arc-icon-trash', () => actions.onPermanentDelete?.())
  ];
}

function libraryMenuRows(input: BuildCardContextMenuRowsInput): ContextMenuRow[] {
  const { inMoodboard, hasSourcePath, actions } = input;
  const moodboardLabel = inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд';
  const moodboardIcon = inMoodboard ? 'arc-icon-bookmark-minus' : 'arc-icon-bookmark-plus';

  const rows: ContextMenuRow[] = [
    itemRow('open', 'Открыть', 'arc-icon-eye', actions.onOpen),
    itemRow('moodboard', moodboardLabel, moodboardIcon, actions.onToggleMoodboard),
    itemRow('collections', 'Добавить в коллекцию', 'arc-icon-layout-grid', actions.onOpenCollections),
    itemRow('similar', 'Найти похожее', 'arc-icon-search', actions.onFindSimilar),
    itemRow('open-folder', 'Открыть папку исходника', 'arc-icon-folder-open', actions.onOpenSourceFolder, {
      disabled: !hasSourcePath
    })
  ];

  if (input.scope.kind === 'collection' && actions.onRemoveFromCollection) {
    rows.push(
      itemRow('remove-collection', 'Убрать из этой коллекции', 'arc-icon-layout-grid', actions.onRemoveFromCollection)
    );
  }

  if (input.scope.kind === 'moodboard-cards' && actions.onRemoveFromMoodboard) {
    rows.push(
      itemRow('remove-moodboard', 'Убрать из мудборда', 'arc-icon-bookmark-minus', actions.onRemoveFromMoodboard)
    );
  }

  rows.push(
    { type: 'separator', key: 'sep-danger' },
    itemRow('trash', 'Отправить в корзину', 'arc-icon-trash', actions.onSendToTrash)
  );

  return rows;
}

export function buildCardContextMenuRows(input: BuildCardContextMenuRowsInput): ContextMenuRow[] {
  if (input.scope.kind === 'trash') {
    return trashMenuRows(input);
  }
  return libraryMenuRows(input);
}

export function resolveGalleryCardContextMenuScope(
  libraryScope: 'all' | 'untagged' | 'trash'
): BuildCardContextMenuRowsInput['scope'] {
  if (libraryScope === 'trash') return { kind: 'trash' };
  return { kind: 'library' };
}
