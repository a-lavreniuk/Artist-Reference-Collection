import SettingsPanelStub from '../../../components/settings/SettingsPanelStub';
import SettingsGeneralPanel from './SettingsGeneralPanel';
import SettingsNotificationsPanel from './SettingsNotificationsPanel';
import SettingsScreenshotsPanel from './SettingsScreenshotsPanel';

export { SettingsGeneralPanel };

export function SettingsScreenshotsPanelRoute() {
  return <SettingsScreenshotsPanel />;
}

export function SettingsNotificationsPanelRoute() {
  return <SettingsNotificationsPanel />;
}

export function SettingsShortcutsPanel() {
  return <SettingsPanelStub title="Горячие клавиши" />;
}

export function SettingsLibraryPanel() {
  return <SettingsPanelStub title="Библиотека" />;
}

export function SettingsBackupPanel() {
  return <SettingsPanelStub title="Резервная копия" />;
}

export function SettingsIntegrityPanel() {
  return <SettingsPanelStub title="Проверка целостности" />;
}

export function SettingsAutoImportPanel() {
  return <SettingsPanelStub title="Автоимпорт" />;
}

export function SettingsAiSearchPanel() {
  return <SettingsPanelStub title="AI Поиск" />;
}

export function SettingsUpdatesPanel() {
  return <SettingsPanelStub title="Обновления" />;
}
