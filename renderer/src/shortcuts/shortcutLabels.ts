import { formatShortcutLabel } from './formatShortcutLabel';
import type { ShortcutId } from './shortcutRegistry';
import { getShortcutById } from './shortcutRegistry';

export function shortcutDisplayLabel(id: ShortcutId): string {
  const def = getShortcutById(id);
  if (!def) return '';
  return formatShortcutLabel(def.defaultAccelerator);
}

/** Primary display label for menus (first accelerator when multiple). */
export function shortcutMenuLabel(id: ShortcutId): string {
  const def = getShortcutById(id);
  if (!def) return '';
  const acc = def.defaultAccelerator;
  const primary = Array.isArray(acc) ? acc[0] : acc;
  return formatShortcutLabel(primary);
}
