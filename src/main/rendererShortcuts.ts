import type { BrowserWindow, Input } from 'electron';

/** Shortcut ids forwarded to renderer when Chromium would swallow the key combo. */
export type RendererShortcutId =
  | 'global.search'
  | 'global.import'
  | 'navigation.back'
  | 'navigation.forward'
  | 'navigation.gallery'
  | 'navigation.collections'
  | 'navigation.moodboard'
  | 'navigation.board';

type ShortcutMatcher = { id: RendererShortcutId; match: (input: Input) => boolean };

function isMod(input: Input): boolean {
  return input.control || input.meta;
}

function digitMatch(input: Input, digit: string): boolean {
  return input.key === digit || input.code === `Digit${digit}` || input.code === `Numpad${digit}`;
}

const MATCHERS: ShortcutMatcher[] = [
  {
    id: 'global.search',
    match: (i) => isMod(i) && !i.shift && !i.alt && i.key.toLowerCase() === 'f'
  },
  {
    id: 'global.import',
    match: (i) => isMod(i) && !i.shift && !i.alt && i.key.toLowerCase() === 'o'
  },
  {
    id: 'navigation.gallery',
    match: (i) => isMod(i) && !i.shift && !i.alt && digitMatch(i, '1')
  },
  {
    id: 'navigation.collections',
    match: (i) => isMod(i) && !i.shift && !i.alt && digitMatch(i, '2')
  },
  {
    id: 'navigation.moodboard',
    match: (i) => isMod(i) && !i.shift && !i.alt && digitMatch(i, '3')
  },
  {
    id: 'navigation.board',
    match: (i) => isMod(i) && !i.shift && !i.alt && digitMatch(i, '4')
  },
  {
    id: 'navigation.back',
    match: (i) => i.alt && !isMod(i) && !i.shift && (i.key === 'ArrowLeft' || i.code === 'ArrowLeft')
  },
  {
    id: 'navigation.forward',
    match: (i) => i.alt && !isMod(i) && !i.shift && (i.key === 'ArrowRight' || i.code === 'ArrowRight')
  }
];

export function matchRendererShortcut(input: Input): RendererShortcutId | null {
  if (input.type !== 'keyDown') return null;
  for (const { id, match } of MATCHERS) {
    if (match(input)) return id;
  }
  return null;
}

export function bindRendererShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    const id = matchRendererShortcut(input);
    if (!id) return;
    event.preventDefault();
    if (win.webContents.isDestroyed()) return;
    win.webContents.send('arc:renderer-shortcut', id);
  });
}
