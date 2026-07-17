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

/** Physical letter from KeyboardEvent.code — layout-independent (EN/RU/…). */
export function physicalLetterFromCode(code: string): string | null {
  const match = /^Key([A-Z])$/.exec(code);
  return match?.[1] ?? null;
}

function eventKeyToken(e: KeyboardEvent): string {
  const physicalLetter = physicalLetterFromCode(e.code);
  if (physicalLetter) return physicalLetter;

  if (e.key === '+' || e.key === '=') return e.shiftKey && e.key === '=' ? 'Plus' : 'Equal';
  if (e.key === '-') return 'Minus';
  if (e.key === '`') return 'Backquote';
  if (e.key === 'Delete') return 'Delete';
  if (e.key === 'Backspace') return 'Backspace';
  if (e.key === 'Escape') return 'Escape';
  if (e.code === 'Space' || e.key === ' ') return 'Space';
  if (e.code === 'BracketLeft') return 'BracketLeft';
  if (e.code === 'BracketRight') return 'BracketRight';
  if (e.code === 'Comma' || e.key === ',') return 'Comma';
  if (e.code === 'Period' || e.key === '.') return 'Period';
  if (e.code.startsWith('Digit')) return e.code.slice(5);
  if (e.code.startsWith('Numpad') && /^\d$/.test(e.code.slice(6))) return e.code.slice(6);
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
    return token === expected || token === parsedKey || e.key === expected || e.code === expected;
  }

  // Single Latin letter in accelerator: match physical key so RU layout works (KeyR → "к").
  if (parsedKey.length === 1 && /[A-Za-z]/.test(parsedKey)) {
    const physical = physicalLetterFromCode(e.code);
    if (physical) return physical === parsedKey.toUpperCase();
    return token.toUpperCase() === parsedKey.toUpperCase();
  }

  if (parsedKey === 'BracketLeft' || parsedKey === 'BracketRight' || parsedKey === 'Comma' || parsedKey === 'Period') {
    return token === parsedKey || e.code === parsedKey;
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

function eventMatchesPhysicalLetter(e: KeyboardEvent, letter: string): boolean {
  const physical = physicalLetterFromCode(e.code);
  if (physical) return physical === letter.toUpperCase();
  return e.key.toLowerCase() === letter.toLowerCase();
}

/** Undo: mod+Z without shift (shift+Z is redo). Layout-independent via KeyZ. */
export function matchesMoodboardUndo(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (!eventMatchesPhysicalLetter(e, 'Z')) return false;
  return !e.shiftKey;
}

/** Redo: mod+Y or mod+Shift+Z. Layout-independent via KeyY / KeyZ. */
export function matchesMoodboardRedo(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (eventMatchesPhysicalLetter(e, 'Y')) return true;
  return e.shiftKey && eventMatchesPhysicalLetter(e, 'Z');
}
