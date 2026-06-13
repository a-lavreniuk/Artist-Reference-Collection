import MessageModal from '../../../components/layout/MessageModal';
import ConfirmModal from '../ConfirmModal';
import { useSettingsLibraryIntegrity } from '../hooks/useSettingsLibraryIntegrity';

const LABEL_DESCRIPTION =
  'Проверьте базу данных на наличие ошибок, отсутствующих файлов или некорректных ссылок';

/** Figma 1036:36251 — Проверка целостности */
export default function SettingsIntegrityPanel() {
  const { integrityBusy, infoModal, setInfoModal, warnModal, setWarnModal, runIntegrity } =
    useSettingsLibraryIntegrity();

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="typo-p-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
            <button
              type="button"
              className="btn btn-secondary btn-ds"
              onClick={() => void runIntegrity()}
              disabled={!window.arc || integrityBusy}
            >
              <span className="btn-ds__value">{integrityBusy ? '…' : 'Проверить'}</span>
            </button>
          </div>
        </div>
      </div>

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}

      {warnModal ? (
        <ConfirmModal
          title="Предупреждения"
          message={warnModal.text}
          confirmLabel="Исправить"
          cancelLabel="Закрыть"
          onCancel={() => setWarnModal(null)}
          onConfirm={() => void warnModal.onFix()}
        />
      ) : null}
    </>
  );
}
