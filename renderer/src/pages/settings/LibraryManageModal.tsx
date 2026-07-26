import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../../components/layout/FloatingModalPanel';
import MessageModal from '../../components/layout/MessageModal';
import ConfirmDeleteLibraryModal from '../../components/layout/ConfirmDeleteLibraryModal';
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== state.library.name;
  const nameInvalid = (emptySubmitted && !trimmedName) || fieldError;
  const canSave = !busy && Boolean(trimmedName) && nameChanged && !nameInvalid;

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, deleteConfirmOpen]);

  if (deleteError) {
    return (
      <MessageModal
        title="Сообщение"
        message={deleteError}
        onClose={() => setDeleteError(null)}
        closeLabel="Понятно"
      />
    );
  }

  const submitRename = async () => {
    if (!canSave) {
      if (!trimmedName) {
        setEmptySubmitted(true);
        setFieldError(true);
      }
      return;
    }
    const res = await onRename(state.library.id, trimmedName);
    if (res.ok) {
      onClose();
      return;
    }
    if (res.fieldError) setFieldError(true);
  };

  return (
    <>
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
                  className={`field input-live${trimmedName ? ' has-value' : ''}${nameInvalid ? ' field-error' : ''}`}
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
            <footer className="arc-modal__footer arc-modal__footer--actions-3">
              {canDelete ? (
                <button
                  type="button"
                  className="btn btn-ds btn-s btn-danger"
                  disabled={busy}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <span className="btn-ds__value">Удалить</span>
                </button>
              ) : (
                <span />
              )}
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
                  disabled={!canSave}
                >
                  <span className="btn-ds__value">{busy ? '…' : 'Сохранить'}</span>
                </button>
              </div>
            </footer>
          </FloatingModalPanel>
        )}
      </ArcAnimatedModalHost>

      {deleteConfirmOpen ? (
        <ConfirmDeleteLibraryModal
          libraryName={state.library.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            setDeleteConfirmOpen(false);
            const res = await onDelete(state.library.id, 'disk');
            if (res.ok) {
              onClose();
              return;
            }
            setDeleteError(res.error?.trim() || 'Не удалось удалить библиотеку');
          }}
        />
      ) : null}
    </>
  );
}
