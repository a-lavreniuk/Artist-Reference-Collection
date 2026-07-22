import ToastAlert from '../../../components/alert/ToastAlert';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import ConfirmModal from '../ConfirmModal';
import { BACKUP_PARTS } from '../hooks/settingsLibraryTypes';
import { useSettingsLibraryBackup } from '../hooks/useSettingsLibraryBackup';

const LABEL_CREATE =
  'Создание архивной копии базы данных. Архив можно разделить на несколько частей';
const LABEL_RESTORE =
  'Восстановить базу данных из резервной копии. Выберите архив, или первую часть из серии файлов';

/** Figma 1036:35873 — Резервная копия */
export default function SettingsBackupPanel() {
  const {
    confirmedParts,
    backupAlert,
    setBackupAlert,
    showRestoreConfirm,
    setShowRestoreConfirm,
    perPartLabel,
    onClickBackupOption,
    runRestoreFlow
  } = useSettingsLibraryBackup();

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">{LABEL_CREATE}</p>
            <div className="arc-settings-backup-parts" role="group" aria-label="Количество частей резервной копии">
              {BACKUP_PARTS.map((n) => {
                const selected = confirmedParts === n;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-secondary btn-ds${selected ? ' state-hover' : ''}`}
                    onClick={() => void onClickBackupOption(n)}
                    disabled={!window.arc}
                    aria-pressed={selected}
                  >
                    {n === 1 ? (
                      <>
                        <span className="btn-ds__value">Одним архивом</span>
                        <span className="btn-ds__counter">{perPartLabel(n)}</span>
                      </>
                    ) : (
                      <>
                        <span className="btn-ds__value">{n}</span>
                        <span className="btn-ds__counter">{perPartLabel(n)}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <SettingsSeparator />

          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">{LABEL_RESTORE}</p>
            <button
              type="button"
              className="btn btn-secondary btn-ds"
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!window.arc}
            >
              <span className="btn-ds__value">Восстановить</span>
            </button>
          </div>
        </div>
      </div>

      {showRestoreConfirm ? (
        <ConfirmModal
          title="Восстановление"
          message="Восстановление заменит текущую библиотеку. Приложение перезапустится после завершения. Продолжить?"
          confirmLabel="Продолжить"
          onCancel={() => setShowRestoreConfirm(false)}
          onConfirm={() => void runRestoreFlow()}
        />
      ) : null}

      {backupAlert ? (
        <ToastAlert
          message={backupAlert.message}
          variant={backupAlert.variant}
          onClose={() => setBackupAlert(null)}
          autoDismissMs={backupAlert.variant === 'info' ? 0 : undefined}
          withSound={backupAlert.variant !== 'info'}
        />
      ) : null}
    </>
  );
}
