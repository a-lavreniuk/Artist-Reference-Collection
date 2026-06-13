import { useRef } from 'react';
import SettingsStatisticsPanel from './settings/SettingsStatisticsPanel';
import SettingsHistoryPanel from './settings/SettingsHistoryPanel';
import SettingsDuplicatesPanel from './settings/SettingsDuplicatesPanel';
import SettingsVersionLabel from './SettingsVersionLabel';

type PanelKey = 'statistics' | 'history' | 'duplicates';

type Props = {
  panel: PanelKey;
};

/** Standalone navbar pages (Статистика, История, Поиск дублей) — вне layout настроек. */
export default function SettingsNavbarPanelPage({ panel }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={pageRef}
      className={`arc-settings-page arc-settings-page--legacy arc-ui-kit-scope${panel === 'duplicates' ? ' arc-settings-page--duplicates' : ''}`}
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
    >
      {panel === 'statistics' ? <SettingsStatisticsPanel /> : null}
      {panel === 'history' ? <SettingsHistoryPanel /> : null}
      {panel === 'duplicates' ? <SettingsDuplicatesPanel /> : null}
      <SettingsVersionLabel />
    </div>
  );
}
