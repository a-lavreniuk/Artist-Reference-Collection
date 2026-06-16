import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
// Панели сохранены — вернуть UI после выхода разделов из разработки.
import SettingsStatisticsPanel from './settings/SettingsStatisticsPanel';
import SettingsHistoryPanel from './settings/SettingsHistoryPanel';
import SettingsDuplicatesPanel from './settings/SettingsDuplicatesPanel';

type PanelKey = 'statistics' | 'history' | 'duplicates';

const IN_DEVELOPMENT_PANELS = true;

const PANEL_COPY: Record<PanelKey, typeof EMPTY_STATE_COPY.inDevelopmentStatistics> = {
  statistics: EMPTY_STATE_COPY.inDevelopmentStatistics,
  history: EMPTY_STATE_COPY.inDevelopmentHistory,
  duplicates: EMPTY_STATE_COPY.inDevelopmentDuplicates
};

type Props = {
  panel: PanelKey;
};

/** Standalone navbar pages (Статистика, История, Поиск дублей) — вне layout настроек. */
export default function SettingsNavbarPanelPage({ panel }: Props) {
  if (!IN_DEVELOPMENT_PANELS) {
    return (
      <div
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
      </div>
    );
  }

  return (
    <div
      className={`arc-settings-page arc-settings-page--legacy arc-settings-page--empty-stub arc-ui-kit-scope${panel === 'duplicates' ? ' arc-settings-page--duplicates' : ''}`}
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
    >
      <EmptyState {...PANEL_COPY[panel]} fill />
    </div>
  );
}
