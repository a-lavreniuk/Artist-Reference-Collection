import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../../components/layout/FloatingModalPanel';
import ConfirmModal from './ConfirmModal';
import { hydrateArcNavbarIcons } from '../../components/layout/navbarIconHydrate';
import type { LibraryListItem } from '../../hooks/useLibraries';

type Props = {
  state: { mode: 'edit'; library: LibraryListItem };
  canDelete: boolean;
  busy: boolean;
  onClose: () => void;
  onRename: (libraryId: string, name: string) => Promise<{ ok: boolean; fieldError?: boolean }>;
  onDelete: (libraryId: string, mode: 'disk' | 'unlink') => Promise<{ ok: boolean; error?: string }>;
};

export default function LibraryManageModal({
  state,
  canDelete,
  busy,
  onClose,
  onRename,
  onDelete
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(state.library.name);
  const [emptySubmitted, setEmptySubmitted] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'disk' | 'unlink' | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, deleteMode]);

  if (deleteMode) {
    return (
      <ConfirmModal
        title={deleteMode === 'disk' ? 'Удалить библиотеку с диска?' : 'Отвязать библиотеку?'}
        message={
          deleteMode === 'disk'
            ? `Папка «${state.library.name}» и все файлы будут удалены без возможности восстановления.`
            : `Библиотека «${state.library.name}» исчезнет из списка ARC, файлы на диске останутся.`
        }
        confirmLabel={deleteMode === 'disk' ? 'Удалить' : 'Отвязать'}
        onCancel={() => setDeleteMode(null)}
        onConfirm={async () => {
          const res = await onDelete(state.library.id, deleteMode);
          if (res.ok) onClose();
        }}
      />
    );
  }

  const nameInvalid = (emptySubmitted && !name.trim()) || fieldError;

  const submitRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEmptySubmitted(true);
      setFieldError(true);
      return;
    }
    const res = await onRename(state.library.id, trimmed);
    if (res.ok) {
      onClose();
      return;
    }
    if (res.fieldError) setFieldError(true);
  };

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="library-edit-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcLibraryEditTitle"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcLibraryEditTitle">
              Библиотека
            </h3>
            <button
              type="button"
              className="arc-modal__close"
              aria-label="Закрыть"
              onClick={() => {
                if (!busy) requestClose();
              }}
              disabled={busy}
            >
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <label
                className={`field input-live${name.trim() ? ' has-value' : ''}${nameInvalid ? ' field-error' : ''}`}
                data-live-input
              >
                <input
                  className="input"
                  placeholder="Название библиотеки"
                  value={name}
                  autoFocus
                  aria-invalid={nameInvalid || undefined}
                  disabled={busy}
                  onChange={(event) => {
                    setName(event.target.value);
                    setEmptySubmitted(false);
                    setFieldError(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void submitRename();
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <div className="arc-modal__footer-left">
              {canDelete ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-ds btn-s"
                    disabled={busy}
                    onClick={() => setDeleteMode('unlink')}
                  >
                    <span className="btn-ds__value">Отвязать</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-ds btn-s"
                    disabled={busy}
                    onClick={() => setDeleteMode('disk')}
                  >
                    <span className="btn-ds__value">Удалить</span>
                  </button>
                </>
              ) : null}
            </div>
            <div className="arc-modal__footer-right">
              <button
                type="button"
                className="btn btn-outline btn-ds btn-s"
                onClick={() => {
                  if (!busy) requestClose();
                }}
                disabled={busy}
              >
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                onClick={() => void submitRename()}
                disabled={busy}
              >
                <span className="btn-ds__value">{busy ? '…' : 'Сохранить'}</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
