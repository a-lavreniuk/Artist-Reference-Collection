import DemoAlert from '../../../components/layout/DemoAlert';
import { useAppUpdate } from '../../../components/layout/appUpdateContext';
import ReleaseNotesContent from '../../../components/layout/ReleaseNotesContent';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useSettingsUpdates } from '../hooks/useSettingsUpdates';

/** Figma 1037:39869 — Обновления */
export default function SettingsUpdatesPanel() {
  const { previewReleaseNotes } = useAppUpdate();
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
  const showDevPreview = import.meta.env.DEV && selectedEntry != null && selectedEntry.changes.length > 0;

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
                    <ReleaseNotesContent
                      version={selectedEntry.version}
                      buildDate={selectedEntry.buildDate}
                      changes={selectedEntry.changes}
                      className="arc-release-notes-content arc-settings-updates-changelog__content"
                    />
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

                {showDevPreview ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-ds"
                    disabled={updateBusy}
                    onClick={() =>
                      previewReleaseNotes({
                        version: selectedEntry.version,
                        buildDate: selectedEntry.buildDate,
                        changes: selectedEntry.changes
                      })
                    }
                  >
                    <span className="btn-ds__value">Показать «Что нового»</span>
                  </button>
                ) : null}
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
