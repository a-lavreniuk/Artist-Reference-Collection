import {
  DEVTOOLS_ACCELERATORS,
  FEEDBACK_ACCELERATOR,
  SCREENSHOT_ACCELERATOR
} from '@arc-main-shared/shortcutAccelerators';

export type ShortcutId =
  | 'global.screenshot'
  | 'global.feedback'
  | 'global.search'
  | 'global.import'
  | 'devtools.f12'
  | 'devtools.toggle'
  | 'navigation.back'
  | 'navigation.forward'
  | 'navigation.gallery'
  | 'navigation.collections'
  | 'navigation.moodboard'
  | 'navigation.board'
  | 'moodboard.undo'
  | 'moodboard.redo'
  | 'moodboard.deleteSelection'
  | 'moodboard.clearSelection'
  | 'moodboard.pan'
  | 'moodboard.zoomIn'
  | 'moodboard.zoomOut'
  | 'moodboard.zoomReset'
  | 'moodboard.fitView'
  | 'gallery.deleteSelection'
  | 'gallery.clearSelection'
  | 'gallery.gridLarge'
  | 'gallery.gridMedium'
  | 'gallery.gridSmall'
  | 'gallery.openInNewWindow'
  | 'detail.previous'
  | 'detail.next'
  | 'detail.copySettings'
  | 'detail.pasteSettings';

export type ShortcutGroupId =
  | 'global'
  | 'navigation'
  | 'devtools'
  | 'gallery'
  | 'moodboard'
  | 'detail';

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
  { id: 'navigation', title: 'Навигация' },
  { id: 'devtools', title: 'Разработка' },
  { id: 'gallery', title: 'Галерея' },
  { id: 'moodboard', title: 'Мудборд' },
  { id: 'detail', title: 'Деталка карточки' }
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
    id: 'global.feedback',
    groupId: 'global',
    label: 'Сообщить о проблеме',
    defaultAccelerator: FEEDBACK_ACCELERATOR,
    scope: 'global',
    settingsVisible: true
  },
  {
    id: 'global.search',
    groupId: 'global',
    label: 'Поиск',
    defaultAccelerator: 'CommandOrControl+F',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'global.import',
    groupId: 'global',
    label: 'Импорт файлов',
    defaultAccelerator: 'CommandOrControl+O',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.back',
    groupId: 'navigation',
    label: 'Назад',
    defaultAccelerator: 'Alt+Left',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.forward',
    groupId: 'navigation',
    label: 'Вперёд',
    defaultAccelerator: 'Alt+Right',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.gallery',
    groupId: 'navigation',
    label: 'Библиотека',
    defaultAccelerator: 'CommandOrControl+1',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.collections',
    groupId: 'navigation',
    label: 'Коллекции',
    defaultAccelerator: 'CommandOrControl+2',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.moodboard',
    groupId: 'navigation',
    label: 'Мудборд',
    defaultAccelerator: 'CommandOrControl+3',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'navigation.board',
    groupId: 'navigation',
    label: 'Доска',
    defaultAccelerator: 'CommandOrControl+4',
    scope: 'renderer',
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
    id: 'gallery.deleteSelection',
    groupId: 'gallery',
    label: 'Удалить выделение',
    defaultAccelerator: ['Delete', 'Backspace'],
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'gallery.clearSelection',
    groupId: 'gallery',
    label: 'Снять выделение',
    defaultAccelerator: 'Escape',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'gallery.gridLarge',
    groupId: 'gallery',
    label: 'Сетка: большая',
    defaultAccelerator: 'CommandOrControl+Shift+1',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'gallery.gridMedium',
    groupId: 'gallery',
    label: 'Сетка: средняя',
    defaultAccelerator: 'CommandOrControl+Shift+2',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'gallery.gridSmall',
    groupId: 'gallery',
    label: 'Сетка: маленькая',
    defaultAccelerator: 'CommandOrControl+Shift+3',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'gallery.openInNewWindow',
    groupId: 'gallery',
    label: 'Открыть в новом окне',
    defaultAccelerator: 'CommandOrControl+Shift+O',
    scope: 'renderer',
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
  },
  {
    id: 'moodboard.zoomIn',
    groupId: 'moodboard',
    label: 'Увеличить',
    defaultAccelerator: 'CommandOrControl+Equal',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.zoomOut',
    groupId: 'moodboard',
    label: 'Уменьшить',
    defaultAccelerator: 'CommandOrControl+Minus',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.zoomReset',
    groupId: 'moodboard',
    label: 'Масштаб 100%',
    defaultAccelerator: 'CommandOrControl+0',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'moodboard.fitView',
    groupId: 'moodboard',
    label: 'Вписать в экран',
    defaultAccelerator: 'CommandOrControl+Shift+0',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'detail.previous',
    groupId: 'detail',
    label: 'Предыдущая карточка',
    defaultAccelerator: 'Left',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'detail.next',
    groupId: 'detail',
    label: 'Следующая карточка',
    defaultAccelerator: 'Right',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'detail.copySettings',
    groupId: 'detail',
    label: 'Копировать настройки',
    defaultAccelerator: 'CommandOrControl+Shift+C',
    scope: 'renderer',
    settingsVisible: true
  },
  {
    id: 'detail.pasteSettings',
    groupId: 'detail',
    label: 'Вставить настройки',
    defaultAccelerator: 'CommandOrControl+Shift+V',
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
