import ReleaseNotesContent from '../../../components/layout/ReleaseNotesContent';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useSettingsUpdates } from '../hooks/useSettingsUpdates';

const LABEL_DESCRIPTION =
  'Здесь показаны заметки о текущей версии и можно проверить наличие обновлений. Установка запускается вручную, когда новая версия доступна.';

/** Figma 1037:39869 — Обновления */
export default function SettingsUpdatesPanel() {
  const {
    loading,
    versions,
    selectedEntry,
    checkState,
    availableVersion,
    downloadPercent,
    checkUpdates,
    startUpdate,
    cancelUpdate,
    checking,
    updateBusy
  } = useSettingsUpdates();

  const showUpdateActions = checkState === 'updateAvailable' || updateBusy;

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-updates-panel arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
          </div>

          <SettingsSeparator />

          {loading ? null : versions.length === 0 || !selectedEntry ? (
            <p className="text-m arc-settings-updates-panel__empty">История версий пока недоступна.</p>
          ) : (
            <>
              <div className="arc-settings-updates-panel__head">
                <div className="arc-settings-updates-changelog">
                  <ReleaseNotesContent
                    version={selectedEntry.version}
                    buildDate={selectedEntry.buildDate}
                    changes={selectedEntry.changes}
                    className="arc-release-notes-content arc-settings-updates-changelog__content"
                  />
                </div>
              </div>

              <SettingsSeparator />

              <div className="arc-settings-updates-actions">
                {checkState === 'updateAvailable' && availableVersion ? (
                  <p className="text-m arc-settings-updates-actions__status">
                    Доступна версия {availableVersion}
                  </p>
                ) : null}
                {updateBusy ? (
                  <p className="text-m arc-settings-updates-actions__status">
                    {checkState === 'installing'
                      ? 'Устанавливаем обновление… Приложение скоро перезапустится.'
                      : downloadPercent != null
                        ? `Загрузка обновления… ${Math.round(downloadPercent)}%`
                        : 'Загрузка обновления…'}
                  </p>
                ) : null}

                <div className="arc-settings-updates-actions__buttons">
                  {checkState === 'downloading' ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-ds"
                      onClick={() => void cancelUpdate()}
                    >
                      <span className="btn-ds__value">Отменить</span>
                    </button>
                  ) : showUpdateActions ? (
                    <button
                      type="button"
                      className="btn btn-brand btn-ds"
                      disabled={updateBusy}
                      onClick={() => void startUpdate()}
                    >
                      <span className="btn-ds__value">{updateBusy ? 'Подождите…' : 'Обновить'}</span>
                    </button>
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
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
