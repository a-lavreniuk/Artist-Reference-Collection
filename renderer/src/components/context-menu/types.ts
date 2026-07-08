export type ContextMenuSlot = 'icon' | 'label' | 'counter' | 'shortcut';

export const DEFAULT_CONTEXT_MENU_SLOT_ORDER: ContextMenuSlot[] = ['label', 'icon'];

export type ContextMenuRow =
  | {
      type: 'item';
      key: string;
      label: string;
      iconClass?: string;
      shortcut?: string;
      counter?: string | number;
      slotOrder?: ContextMenuSlot[];
      selected?: boolean;
      disabled?: boolean;
      loading?: boolean;
      /** По умолчанию меню закрывается после выбора; false — для мультивыбора в фильтрах */
      closeOnSelect?: boolean;
      onSelect?: () => void;
    }
  | { type: 'separator'; key: string }
  | { type: 'header'; key: string; label: string };

export const CONTEXT_MENU_WIDTH = 250;
export const CONTEXT_MENU_COLOR_FORMAT_WIDTH = 120;
export const CONTEXT_MENU_ANCHOR_GAP = 8;
