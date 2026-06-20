import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
// Панели сохранены — вернуть UI после выхода разделов из разработки.
import SettingsStatisticsPanel from './settings/SettingsStatisticsPanel';
import SettingsHistoryPanel from './settings/SettingsHistoryPanel';
import SettingsDuplicatesPanel from './settings/SettingsDuplicatesPanel';

type PanelKey = 'statistics' | 'history' | 'duplicates';

const PANEL_IN_DEVELOPMENT: Record<PanelKey, boolean> = {
  statistics: false,
  history: false,
  duplicates: true
};

const PANEL_COPY: Record<PanelKey, typeof EMPTY_STATE_COPY.inDevelopmentStatistics> = {
  statistics: EMPTY_STATE_COPY.inDevelopmentStatistics,
  history: EMPTY_STATE_COPY.inDevelopmentHistory,
  duplicates: EMPTY_STATE_COPY.inDevelopmentDuplicates
};

type Props = {
  panel: PanelKey;
};

function panelContent(panel: PanelKey) {
  if (panel === 'statistics') return <SettingsStatisticsPanel />;
  if (panel === 'history') return <SettingsHistoryPanel />;
  return <SettingsDuplicatesPanel />;
}

/** Standalone navbar pages (Статистика, История, Поиск дублей) — вне layout настроек. */
export default function SettingsNavbarPanelPage({ panel }: Props) {
  const inDevelopment = PANEL_IN_DEVELOPMENT[panel];

  return (
    <div
      className={`arc-settings-page arc-settings-page--legacy${inDevelopment ? ' arc-settings-page--empty-stub' : ''} arc-ui-kit-scope${panel === 'duplicates' ? ' arc-settings-page--duplicates' : ''}${panel === 'history' ? ' arc-settings-page--history' : ''}`}
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
    >
      {inDevelopment ? <EmptyState {...PANEL_COPY[panel]} fill /> : panelContent(panel)}
    </div>
  );
}
