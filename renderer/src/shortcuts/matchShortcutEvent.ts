import type { ShortcutId } from './shortcutRegistry';
import { getShortcutById } from './shortcutRegistry';

type ParsedAccelerator = {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

function parseAccelerator(accelerator: string): ParsedAccelerator {
  const parts = accelerator.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  return {
    ctrl: mods.includes('Control') || mods.includes('CommandOrControl'),
    meta: mods.includes('Command') || mods.includes('Meta'),
    alt: mods.includes('Alt'),
    shift: mods.includes('Shift'),
    key
  };
}

function eventKeyToken(e: KeyboardEvent): string {
  if (e.key === '+' || e.key === '=') return e.shiftKey && e.key === '=' ? 'Plus' : 'Equal';
  if (e.key === '-') return 'Minus';
  if (e.key === '`') return 'Backquote';
  if (e.key === 'Delete') return 'Delete';
  if (e.key === 'Backspace') return 'Backspace';
  if (e.key === 'Escape') return 'Escape';
  if (e.code === 'Space' || e.key === ' ') return 'Space';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

function matchesParsed(e: KeyboardEvent, parsed: ParsedAccelerator): boolean {
  const mod = e.ctrlKey || e.metaKey;
  const needsMod = parsed.ctrl || parsed.meta;
  if (needsMod && !mod) return false;
  if (!needsMod && mod && parsed.key.length === 1) return false;

  if (parsed.alt && !e.altKey) return false;
  if (!parsed.alt && e.altKey) return false;
  if (parsed.shift && !e.shiftKey) return false;
  if (!parsed.shift && e.shiftKey && parsed.key !== 'Plus') return false;

  const token = eventKeyToken(e);

  if (parsed.key === 'Plus') {
    return token === 'Plus' || (e.key === '+' && e.shiftKey);
  }

  if (parsed.key.length === 1) {
    return token.toUpperCase() === parsed.key.toUpperCase();
  }

  return token === parsed.key;
}

/** Returns true when the keyboard event matches a shortcut from the registry. */
export function matchesShortcut(e: KeyboardEvent, id: ShortcutId): boolean {
  const def = getShortcutById(id);
  if (!def) return false;

  const list = Array.isArray(def.defaultAccelerator)
    ? def.defaultAccelerator
    : [def.defaultAccelerator];

  return list.some((acc) => matchesParsed(e, parseAccelerator(acc)));
}

/** Undo: mod+Z without shift (shift+Z is redo). */
export function matchesMoodboardUndo(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (e.key.toLowerCase() !== 'z') return false;
  return !e.shiftKey;
}

/** Redo: mod+Y or mod+Shift+Z. */
export function matchesMoodboardRedo(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (e.key.toLowerCase() === 'y') return true;
  return e.shiftKey && e.key.toLowerCase() === 'z';
}
