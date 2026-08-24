export const APP_MENU_COMMAND_PREFIX = '--arc-command=';

export const APP_MENU_COMMANDS = [
  'open',
  'hide',
  'add',
  'screenshot',
  'gallery',
  'collections',
  'moodboard',
  'settings',
  'quit'
] as const;

export type AppMenuCommand = (typeof APP_MENU_COMMANDS)[number];

export type AppMenuRendererAction =
  | { type: 'navigate'; path: string; deliveryId: number }
  | { type: 'import-files'; paths: string[]; deliveryId: number };

export const APP_MENU_NAV_PATH: Record<'gallery' | 'collections' | 'moodboard' | 'settings', string> = {
  gallery: '/gallery',
  collections: '/collections',
  moodboard: '/moodboard',
  settings: '/settings/general'
};

const COMMAND_SET = new Set<string>(APP_MENU_COMMANDS);

export function isAppMenuCommand(value: string): value is AppMenuCommand {
  return COMMAND_SET.has(value);
}

export function appMenuCommandFlag(command: AppMenuCommand): string {
  return `${APP_MENU_COMMAND_PREFIX}${command}`;
}

export function parseAppMenuCommandFromArgv(argv: readonly string[]): AppMenuCommand | null {
  for (const arg of argv) {
    if (!arg.startsWith(APP_MENU_COMMAND_PREFIX)) continue;
    const value = arg.slice(APP_MENU_COMMAND_PREFIX.length);
    if (isAppMenuCommand(value)) return value;
  }
  return null;
}

/** Холодный старт с этими командами не должен показывать окно, пока команда сама этого не решит. */
export function isSilentStartupAppMenuCommand(command: AppMenuCommand | null): boolean {
  return command === 'add' || command === 'hide' || command === 'screenshot';
}
