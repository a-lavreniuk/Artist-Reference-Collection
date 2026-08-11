/** True when the event target is a text field or contenteditable — shortcuts should not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Только всплывающее меню. Класс `context-menu` переиспользуют статичные сайдбары
 * (коллекции, метки, настройки) — они не должны блокировать шорткаты.
 */
export function isContextMenuOpen(): boolean {
  return Boolean(document.querySelector('.context-menu:not(.context-menu--static)'));
}

/** Block renderer shortcuts while typing or when a context menu is open. */
export function isRendererShortcutBlocked(event: KeyboardEvent): boolean {
  if (isEditableTarget(event.target)) return true;
  if (isContextMenuOpen()) return true;
  return false;
}
