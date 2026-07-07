import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
// Панели сохранены — вернуть UI после выхода разделов из разработки.
import SettingsStatisticsPanel from './settings/SettingsStatisticsPanel';
import SettingsHistoryPanel from './settings/SettingsHistoryPanel';

type PanelKey = 'statistics' | 'history';

const PANEL_IN_DEVELOPMENT: Record<PanelKey, boolean> = {
  statistics: false,
  history: false
};

const PANEL_COPY: Record<PanelKey, { title: string; subtitle: string }> = {
  statistics: EMPTY_STATE_COPY.inDevelopmentStatistics,
  history: EMPTY_STATE_COPY.inDevelopmentHistory
};

type Props = {
  panel: PanelKey;
};

function panelContent(panel: PanelKey) {
  if (panel === 'statistics') return <SettingsStatisticsPanel />;
  return <SettingsHistoryPanel />;
}

/** Standalone navbar pages (Статистика, История) — вне layout настроек. */
export default function SettingsNavbarPanelPage({ panel }: Props) {
  const inDevelopment = PANEL_IN_DEVELOPMENT[panel];

  return (
    <div
      className={`arc-settings-page arc-settings-page--legacy${inDevelopment ? ' arc-settings-page--empty-stub' : ''} arc-ui-kit-scope${panel === 'history' ? ' arc-settings-page--history' : ''}`}
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
      {...(panel === 'statistics' ? { 'data-interface-tour-anchor': 'statistics-page' } : {})}
      {...(panel === 'history' ? { 'data-interface-tour-anchor': 'history-page' } : {})}
    >
      {inDevelopment ? <EmptyState {...PANEL_COPY[panel]} fill /> : panelContent(panel)}
    </div>
  );
}
