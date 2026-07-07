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
    showOpenExistingConfirm,
    oldFolderPath,
    infoModal,
    setInfoModal,
    setOldFolderPath,
    createLibraryFlow,
    chooseLibraryFolderFlow,
    confirmOpenExistingLibrary,
    cancelOpenExistingLibrary,
    runMigrate,
    cancelMigrateConfirm,
    trashOldFolder,
    openOldFolderInExplorer
  } = useSettingsLibraryPath();

  const hasLibrary = Boolean(libraryPath);

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
            <div className="arc-settings-action-row">
              {hasLibrary ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-ds"
                  onClick={() => void chooseLibraryFolderFlow()}
                  disabled={busy || !window.arc}
                >
                  <span className="btn-ds__value">{busy ? '…' : 'Перенести папку'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-brand btn-ds"
                    onClick={() => void createLibraryFlow()}
                    disabled={busy || !window.arc}
                  >
                    <span className="btn-ds__value">{busy ? '…' : 'Создать библиотеку'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-ds"
                    onClick={() => void chooseLibraryFolderFlow()}
                    disabled={busy || !window.arc}
                  >
                    <span className="btn-ds__value">Выбрать существующую</span>
                  </button>
                </>
              )}
              <span className="text-m arc-settings-action-row__meta" title={libraryPath ?? undefined}>
                {libraryPath ?? 'Не выбрана'}
              </span>
            </div>
            {migrateError ? <p className="hint">{migrateError}</p> : null}
            {!window.arc && arcHint ? (
              <div className="hint arc-settings-electron-hint">{arcHint}</div>
            ) : null}
          </div>
        </div>
      </div>

      {showOpenExistingConfirm ? (
        <ConfirmModal
          title="Открыть библиотеку?"
          message="В папке «Библиотека ARC» уже есть библиотека ARC. Открыть её вместо создания новой?"
          confirmLabel="Открыть"
          onCancel={cancelOpenExistingLibrary}
          onConfirm={() => void confirmOpenExistingLibrary()}
        />
      ) : null}

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
