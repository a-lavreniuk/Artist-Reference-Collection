import { useEffect, useState } from 'react';
import ConfirmModal from '../ConfirmModal';
import { useSettingsLibraryIntegrity } from '../hooks/useSettingsLibraryIntegrity';
import IntegrityReportView from '../integrity/IntegrityReportView';

const LABEL_DESCRIPTION =
  'Проверьте базу данных на наличие ошибок, отсутствующих файлов или некорректных ссылок';

/** Figma 1036:36251 — Проверка целостности */
export default function SettingsIntegrityPanel() {
  const {
    phase,
    report,
    confirm,
    setConfirm,
    fileBackend,
    runIntegrity,
    rescan,
    fixMetadata,
    requestDeleteCard,
    requestDeleteOrphan,
    requestDeleteAllOrphans,
    requestRemoveInvalidRows,
    showOrphanInFolder,
    isScanning,
    isBusy
  } = useSettingsLibraryIntegrity();

  const [libraryRootAbs, setLibraryRootAbs] = useState<string | null>(null);

  useEffect(() => {
    if (!window.arc?.getLibraryPath) return;
    void window.arc.getLibraryPath().then((path) => setLibraryRootAbs(path ?? null));
  }, []);

  const showReport = phase === 'ready' && report;

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div
          className={`arc-settings-main__content arc-ui-kit-scope${showReport ? ' arc-settings-main__content--integrity' : ''}`}
          data-btn-size="m"
        >
          <div className="arc-settings-desc-block">
            <p className="typo-p-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
            <button
              type="button"
              className="btn btn-secondary btn-ds"
              onClick={() => void runIntegrity()}
              disabled={!window.arc || isScanning}
            >
              <span className="btn-ds__value">{isScanning && phase !== 'ready' ? 'Проверка…' : 'Проверить'}</span>
            </button>
          </div>

          {phase === 'no_metadata' ? (
            <div className="arc-integrity-ok panel elevation-default">
              <p className="typo-p-m">Нет метаданных библиотеки</p>
            </div>
          ) : null}

          {showReport ? (
            <IntegrityReportView
              report={report}
              libraryRootAbs={libraryRootAbs}
              busy={isBusy}
              fileBackend={fileBackend}
              onFixMetadata={() => void fixMetadata()}
              onDeleteCard={requestDeleteCard}
              onDeleteOrphan={requestDeleteOrphan}
              onDeleteAllOrphans={requestDeleteAllOrphans}
              onShowOrphanInFolder={(rel) => void showOrphanInFolder(rel)}
              onRemoveInvalidRows={requestRemoveInvalidRows}
            />
          ) : null}
        </div>
      </div>

      {confirm ? (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel="Отмена"
          confirmVariant="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirm.onConfirm()}
        />
      ) : null}
    </>
  );
}
