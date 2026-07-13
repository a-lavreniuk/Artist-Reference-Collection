import type { ShortcutId } from './shortcutRegistry';
import { getShortcutById } from './shortcutRegistry';

type ParsedAccelerator = {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

const ARROW_ALIASES: Record<string, string> = {
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Up: 'ArrowUp',
  Down: 'ArrowDown'
};

function normalizeAcceleratorKey(key: string): string {
  return ARROW_ALIASES[key] ?? key;
}

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
  if (e.code === 'BracketLeft') return 'BracketLeft';
  if (e.code === 'BracketRight') return 'BracketRight';
  if (e.key === ',') return 'Comma';
  if (e.key === '.') return 'Period';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

function eventMatchesKey(e: KeyboardEvent, parsedKey: string): boolean {
  const token = eventKeyToken(e);
  const expected = normalizeAcceleratorKey(parsedKey);

  if (parsedKey === 'Plus') {
    return token === 'Plus' || (e.key === '+' && e.shiftKey) || (e.key === '=' && e.shiftKey);
  }

  if (parsedKey === 'Equal') {
    return token === 'Equal' || token === 'Plus' || e.key === '=' || e.key === '+';
  }

  if (parsedKey === 'Minus') {
    return token === 'Minus' || e.key === '-';
  }

  if (parsedKey.length === 1 && /^\d$/i.test(parsedKey)) {
    const digit = parsedKey.toUpperCase();
    return (
      token === digit ||
      e.key === parsedKey ||
      e.code === `Digit${parsedKey}` ||
      e.code === `Numpad${parsedKey}`
    );
  }

  if (expected.startsWith('Arrow')) {
    return token === expected || token === parsedKey;
  }

  if (parsedKey.length === 1) {
    return token.toUpperCase() === parsedKey.toUpperCase();
  }

  if (parsedKey === 'BracketLeft' || parsedKey === 'BracketRight' || parsedKey === 'Comma' || parsedKey === 'Period') {
    return token === parsedKey;
  }

  return token === parsedKey || token === expected;
}

function matchesParsed(e: KeyboardEvent, parsed: ParsedAccelerator): boolean {
  const mod = e.ctrlKey || e.metaKey;
  const needsMod = parsed.ctrl || parsed.meta;
  if (needsMod && !mod) return false;

  const needsAlt = parsed.alt;
  if (needsAlt && !e.altKey) return false;
  if (!needsAlt && e.altKey && !parsed.ctrl && !parsed.meta) {
    // Plain key shortcuts (arrows) must not fire with Alt held.
    if (!parsed.shift) return false;
  }

  if (parsed.shift && !e.shiftKey) return false;
  if (!parsed.shift && e.shiftKey && parsed.key !== 'Plus' && parsed.key !== 'Equal') return false;

  if (!needsMod && !needsAlt && !parsed.shift) {
    if (e.ctrlKey || e.metaKey) return false;
  }

  if (!needsMod && mod && parsed.key.length === 1 && /[A-Za-z0-9]/.test(parsed.key)) {
    return false;
  }

  return eventMatchesKey(e, parsed.key);
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
