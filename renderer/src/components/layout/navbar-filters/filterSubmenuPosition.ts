import { CONTEXT_MENU_ANCHOR_GAP } from '../../context-menu/types';

const FILTER_MAIN_MENU_SELECTOR = '.context-menu[aria-label="Фильтры"]';

/** Второй уровень фильтров: справа от первого меню, по вертикали — у выбранной строки. */
export function resolveFilterSubmenuPosition(
  rowKey: string
): { x: number; y: number } | null {
  const mainPanel = document.querySelector<HTMLElement>(FILTER_MAIN_MENU_SELECTOR);
  if (!mainPanel) return null;

  const mainRect = mainPanel.getBoundingClientRect();
  const rowEl = mainPanel.querySelector<HTMLElement>(`[data-context-menu-key="${rowKey}"]`);
  const rowTop = rowEl?.getBoundingClientRect().top;

  const y = rowTop ?? mainRect.top;

  return {
    x: mainRect.right + CONTEXT_MENU_ANCHOR_GAP,
    y
  };
}
