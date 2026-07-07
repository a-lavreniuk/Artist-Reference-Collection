import SettingsAiSearchPanel from './SettingsAiSearchPanel';
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
export { default as SettingsBrowserExtensionPanel } from './SettingsBrowserExtensionPanel';
export { default as SettingsUpdatesPanel } from './SettingsUpdatesPanel';

export function SettingsAiSearchPanelRoute() {
  return <SettingsAiSearchPanel />;
}

export { SettingsAiSearchPanelRoute as SettingsAiSearchPanel };
