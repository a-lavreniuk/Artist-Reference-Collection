import { CONTEXT_MENU_ANCHOR_GAP } from '../context-menu/types';

const DETAIL_FIELD_MENU_SELECTOR = '.context-menu[aria-label="Параметры свойства"]';

/** Второй уровень меню свойства: справа от основного, по вертикали — у строки типа. */
export function resolveDetailFieldSubmenuPosition(
  rowKey: string
): { x: number; y: number } | null {
  const mainPanel = document.querySelector<HTMLElement>(DETAIL_FIELD_MENU_SELECTOR);
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
