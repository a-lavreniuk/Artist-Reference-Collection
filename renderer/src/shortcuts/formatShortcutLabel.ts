export type ShortcutPlatform = 'darwin' | 'win32' | 'other';

export function detectShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)) {
    return 'darwin';
  }
  return 'win32';
}

const MOD_WIN: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Control: 'Ctrl',
  Command: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'Win'
};

const MOD_DARWIN: Record<string, string> = {
  CommandOrControl: '⌘',
  Control: '⌃',
  Command: '⌘',
  Alt: '⌥',
  Shift: '⇧',
  Meta: '⌘'
};

const KEY_LABELS: Record<string, string> = {
  Plus: '+',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Escape: 'Esc',
  Space: 'Space'
};

function formatKeyToken(token: string, platform: ShortcutPlatform): string {
  const mods = platform === 'darwin' ? MOD_DARWIN : MOD_WIN;
  if (token in mods) return mods[token]!;
  if (token in KEY_LABELS) return KEY_LABELS[token]!;
  if (token.length === 1) return token.toUpperCase();
  return token;
}

/** Formats Electron accelerator(s) for display (platform-native). */
export function formatShortcutLabel(
  accelerator: string | readonly string[],
  platform: ShortcutPlatform = detectShortcutPlatform()
): string {
  const list = Array.isArray(accelerator) ? accelerator : [accelerator];
  return list
    .map((item) =>
      item
        .split('+')
        .map((part) => formatKeyToken(part, platform))
        .join(platform === 'darwin' ? '' : '+')
    )
    .join(' / ');
}
