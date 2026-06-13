import {
  DEVTOOLS_ACCELERATORS,
  SCREENSHOT_ACCELERATOR
} from '@arc-main-shared/shortcutAccelerators';

export type ShortcutId =
  | 'global.screenshot'
  | 'devtools.f12'
  | 'devtools.toggle'
  | 'moodboard.undo'
  | 'moodboard.redo'
  | 'moodboard.deleteSelection'
  | 'moodboard.clearSelection'
  | 'moodboard.pan';

export type ShortcutGroupId = 'global' | 'devtools' | 'moodboard';

export type ShortcutDefinition = {
  id: ShortcutId;
  groupId: ShortcutGroupId;
  /** Menu-style label shown in settings and context menus. */
  label: string;
  /** Electron accelerator string(s). Future: user override via customAccelerator in prefs. */
  defaultAccelerator: string | readonly string[];
  /** Where the shortcut is handled. */
  scope: 'global' | 'renderer';
  /** Listed in Settings → Горячие клавиши. */
  settingsVisible: boolean;
};

export type ShortcutGroupDefinition = {
  id: ShortcutGroupId;
  title: string;
};

export const SHORTCUT_GROUPS: readonly ShortcutGroupDefinition[] = [
  { id: 'global', title: 'Глобальные' },
  { id: 'devtools', title: 'Разработка' },
  { id: 'moodboard', title: 'Мудборд' }
] as const;

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: 'global.screenshot',
    groupId: 'global',
    label: 'Сделать скриншот',
    defaultAccelerator: SCREENSHOT_ACCELERATOR,
    scope: 'global',
    settingsVisible: true
  },
  {
    id: 'devtools.f12',
    groupId: 'devtools',
    label: 'Инструменты разработчика',
    defaultAccelerator: DEVTOOLS_ACCELERATORS[0],
    scope: 'global',
    settingsVisible: true
  },
  {
    id: 'devtools.toggle',
    groupId: 'devtools',
    label: 'Инструменты разработчика',
    defaultAccelerator: DEVTOOLS_ACCELERATORS[1],
    scope: 'global',
    settingsVisible: true
  },
  {
    id: 'moodboard.undo',
    groupId: 'moodboard',
    label: 'Отменить',
    defaultAccelerator: 'CommandOrControl+Z',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.redo',
    groupId: 'moodboard',
    label: 'Вернуть',
    defaultAccelerator: ['CommandOrControl+Y', 'CommandOrControl+Shift+Z'],
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.deleteSelection',
    groupId: 'moodboard',
    label: 'Удалить выделение',
    defaultAccelerator: ['Delete', 'Backspace'],
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.clearSelection',
    groupId: 'moodboard',
    label: 'Снять выделение',
    defaultAccelerator: 'Escape',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.pan',
    groupId: 'moodboard',
    label: 'Панорамирование',
    defaultAccelerator: 'Space',
    scope: 'renderer',
    settingsVisible: true
  }
] as const;

const byId = new Map(SHORTCUTS.map((s) => [s.id, s]));

export function getShortcutById(id: ShortcutId): ShortcutDefinition | undefined {
  return byId.get(id);
}

export function getSettingsShortcutGroups(): Array<{
  group: ShortcutGroupDefinition;
  shortcuts: ShortcutDefinition[];
}> {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    shortcuts: SHORTCUTS.filter((s) => s.settingsVisible && s.groupId === group.id)
  })).filter((entry) => entry.shortcuts.length > 0);
}

// TODO(shortcuts): persist customAccelerator overrides in AppPreferencesV1 when rebind UI ships.
