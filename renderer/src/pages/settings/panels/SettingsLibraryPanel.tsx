import MessageModal from '../../../components/layout/MessageModal';
import ConfirmModal from '../ConfirmModal';
import OldFolderModal from '../OldFolderModal';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsLibraryPath } from '../hooks/useSettingsLibraryPath';

const LABEL_DESCRIPTION =
  'Папка на компьютере для автоматического сохранения загружаемых файлов. Можно изменить рабочую';

/** Figma 1036:34315 — Библиотека */
export default function SettingsLibraryPanel() {
  const arcHint = useSettingsArcHint();
  const {
    libraryPath,
    busy,
    migrateError,
    showMigrateConfirm,
    oldFolderPath,
    infoModal,
    setInfoModal,
    setOldFolderPath,
    chooseLibraryFolderFlow,
    runMigrate,
    cancelMigrateConfirm,
    trashOldFolder,
    openOldFolderInExplorer
  } = useSettingsLibraryPath();

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="typo-p-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
            <div className="arc-settings-action-row">
              <button
                type="button"
                className="btn btn-secondary btn-ds"
                onClick={() => void chooseLibraryFolderFlow()}
                disabled={busy || !window.arc}
              >
                <span className="btn-ds__value">{busy ? '…' : 'Перенести папку'}</span>
              </button>
              <span className="typo-p-m arc-settings-action-row__meta" title={libraryPath ?? undefined}>
                {libraryPath ?? 'Не выбрана'}
              </span>
            </div>
            {migrateError ? <p className="hint">{migrateError}</p> : null}
            {!window.arc && arcHint ? (
              <div className="typo-p-m hint arc-settings-electron-hint">{arcHint}</div>
            ) : null}
          </div>
        </div>
      </div>

      {showMigrateConfirm ? (
        <ConfirmModal
          title="Перенос библиотеки"
          message="Вы уверены, что хотите перенести файлы? Будет скопировано всё содержимое в выбранную пустую папку."
          confirmLabel="Перенести"
          onCancel={cancelMigrateConfirm}
          onConfirm={() => void runMigrate()}
        />
      ) : null}

      {oldFolderPath ? (
        <OldFolderModal
          pathLabel={oldFolderPath}
          onLeave={() => setOldFolderPath(null)}
          onTrash={() => void trashOldFolder()}
          onOpenInExplorer={openOldFolderInExplorer}
        />
      ) : null}

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}
    </>
  );
}
