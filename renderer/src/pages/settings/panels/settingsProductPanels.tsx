import SettingsPanelStub from '../../../components/settings/SettingsPanelStub';
import SettingsGeneralPanel from './SettingsGeneralPanel';
import SettingsNotificationsPanel from './SettingsNotificationsPanel';
import SettingsScreenshotsPanel from './SettingsScreenshotsPanel';
import SettingsShortcutsPanel from './SettingsShortcutsPanel';

export { SettingsGeneralPanel };

export function SettingsScreenshotsPanelRoute() {
  return <SettingsScreenshotsPanel />;
}

export function SettingsNotificationsPanelRoute() {
  return <SettingsNotificationsPanel />;
}

export function SettingsShortcutsPanelRoute() {
  return <SettingsShortcutsPanel />;
}

export { SettingsShortcutsPanelRoute as SettingsShortcutsPanel };

export { default as SettingsLibraryPanel } from './SettingsLibraryPanel';
export { default as SettingsBackupPanel } from './SettingsBackupPanel';
export { default as SettingsIntegrityPanel } from './SettingsIntegrityPanel';
export { default as SettingsAutoImportPanel } from './SettingsAutoImportPanel';

export function SettingsAiSearchPanel() {
  return <SettingsPanelStub title="AI Поиск" />;
}

export function SettingsUpdatesPanel() {
  return <SettingsPanelStub title="Обновления" />;
}
