import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  folderName: string;
  busy: boolean;
  emptySubmitted: boolean;
  onFolderNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateLibraryModal({
  folderName,
  busy,
  emptySubmitted,
  onFolderNameChange,
  onClose,
  onSubmit
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const nameInvalid = emptySubmitted && !folderName.trim();

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [folderName, busy, emptySubmitted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcOnboardingCreateLibraryTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcOnboardingCreateLibraryTitle">
            Создание библиотеки
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose} disabled={busy}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">
              Придумайте библиотеке название (например, «Сохранёнки») и выберите место на диске для её хранения
            </p>
          </div>
          <div className="arc-modal__slot">
            <label
              className={`field input-live${folderName.trim() ? ' has-value' : ''}${nameInvalid ? ' field-error' : ''}`}
              data-live-input
            >
              <input
                className="input"
                placeholder="Название библиотеки"
                value={folderName}
                autoFocus
                aria-invalid={nameInvalid || undefined}
                disabled={busy}
                onChange={(event) => onFolderNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label="Очистить"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFolderNameChange('');
                }}
              />
            </label>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose} disabled={busy}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              onClick={onSubmit}
              disabled={busy || !window.arc}
            >
              <span className="btn-ds__value">{busy ? '…' : 'Создать'}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
