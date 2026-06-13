import { useMemo, useState } from 'react';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsShortcutRow from '../../../components/settings/SettingsShortcutRow';
import SettingsShortcutsSearch from '../../../components/settings/SettingsShortcutsSearch';
import { formatShortcutLabel } from '../../../shortcuts/formatShortcutLabel';
import { SHORTCUT_GROUPS, SHORTCUTS } from '../../../shortcuts/shortcutRegistry';

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export default function SettingsShortcutsPanel() {
  const [query, setQuery] = useState('');

  const normalizedQuery = normalizeQuery(query);

  const visibleGroups = useMemo(() => {
    return SHORTCUT_GROUPS.map((group) => {
      const shortcuts = SHORTCUTS.filter((item) => {
        if (item.groupId !== group.id || !item.settingsVisible) return false;
        if (!normalizedQuery) return true;
        return item.label.toLowerCase().includes(normalizedQuery);
      });
      return { group, shortcuts };
    }).filter((entry) => entry.shortcuts.length > 0);
  }, [normalizedQuery]);

  return (
    <div className="arc-settings-main__scroll arc-settings-shortcuts-panel">
      <div className="arc-settings-shortcuts-panel__sticky">
        <div className="arc-settings-shortcuts-panel__sticky-inner arc-ui-kit-scope" data-input-size="m">
          <SettingsShortcutsSearch value={query} onChange={setQuery} />
        </div>
        <hr className="arc-settings-shortcuts-panel__sticky-separator" role="separator" />
      </div>

      <div className="arc-settings-shortcuts-panel__list">
        {visibleGroups.map((entry, index) => (
          <div key={entry.group.id} className="arc-settings-shortcuts-panel__group">
            {index > 0 ? <SettingsSeparator /> : null}
            <SettingsSection title={`${entry.group.title} (${entry.shortcuts.length})`}>
              {entry.shortcuts.map((item) => (
                <SettingsShortcutRow
                  key={item.id}
                  label={item.label}
                  shortcut={formatShortcutLabel(item.defaultAccelerator)}
                />
              ))}
            </SettingsSection>
          </div>
        ))}
      </div>
    </div>
  );
}
