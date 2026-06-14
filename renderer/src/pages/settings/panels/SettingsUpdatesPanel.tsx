import DemoAlert from '../../../components/layout/DemoAlert';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useSettingsUpdates } from '../hooks/useSettingsUpdates';

function formatBuildDate(isoDate: string): string {
  const parts = isoDate.trim().split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }
  return isoDate;
}

/** Figma 1037:39869 — Обновления */
export default function SettingsUpdatesPanel() {
  const {
    loading,
    installedVersion,
    versions,
    selectedVersion,
    setSelectedVersion,
    selectedEntry,
    checkState,
    availableVersion,
    downloadPercent,
    alert,
    dismissAlert,
    checkUpdates,
    startUpdate,
    checking,
    updateBusy
  } = useSettingsUpdates();

  const showUpdateActions = checkState === 'updateAvailable' || updateBusy;

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-updates-panel arc-ui-kit-scope" data-btn-size="m">
          {loading ? null : versions.length === 0 ? (
            <p className="typo-p-m arc-settings-updates-panel__empty">История версий пока недоступна.</p>
          ) : (
            <>
              <div className="arc-settings-updates-panel__head">
                <div className="arc-settings-updates-tabs" role="tablist" aria-label="Версии приложения">
                  {versions.map((entry) => {
                    const isCurrent = entry.version === installedVersion;
                    const isSelected = entry.version === selectedVersion;
                    const label = isCurrent ? `${entry.version} Текущая версия` : entry.version;
                    return (
                      <button
                        key={entry.version}
                        type="button"
                        role="tab"
                        className={`arc-settings-updates-tab${isSelected ? ' is-active' : ''}`}
                        aria-selected={isSelected}
                        onClick={() => setSelectedVersion(entry.version)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {selectedEntry ? (
                  <div className="arc-settings-updates-changelog" role="tabpanel">
                    <p className="typo-p-m arc-settings-updates-changelog__date">
                      {formatBuildDate(selectedEntry.buildDate)}
                    </p>
                    {selectedEntry.changes.map((line) => (
                      <p key={line} className="typo-p-m arc-settings-updates-changelog__line">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              <SettingsSeparator />

              <div className="arc-settings-updates-actions">
                {showUpdateActions ? (
                  <div className="arc-settings-updates-actions__update-row">
                    {checkState === 'updateAvailable' && availableVersion ? (
                      <p className="typo-p-m arc-settings-updates-actions__status">
                        Доступна версия {availableVersion}
                      </p>
                    ) : null}
                    {updateBusy ? (
                      <p className="typo-p-m arc-settings-updates-actions__status">
                        {checkState === 'installing'
                          ? 'Устанавливаем обновление… Приложение скоро перезапустится.'
                          : downloadPercent != null
                            ? `Загрузка обновления… ${Math.round(downloadPercent)}%`
                            : 'Загрузка обновления…'}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-brand btn-ds"
                      disabled={updateBusy}
                      onClick={() => void startUpdate()}
                    >
                      <span className="btn-ds__value">{updateBusy ? 'Подождите…' : 'Обновить'}</span>
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn btn-outline btn-ds"
                  disabled={checking || updateBusy}
                  onClick={() => void checkUpdates()}
                >
                  <span className="btn-ds__value">{checking ? '…' : 'Проверить обновления'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {alert ? (
        <DemoAlert message={alert.message} variant={alert.variant} onClose={dismissAlert} />
      ) : null}
    </>
  );
}
