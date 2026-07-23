import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from './FloatingModalPanel';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { invalidateLibraryCache } from '../../services/db';

type Props = {
  onClose: () => void;
};

export default function LibraryWrapMigrationModal({ onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('Основная');
  const [busy, setBusy] = useState(false);
  const [emptySubmitted, setEmptySubmitted] = useState(false);
  const [fieldError, setFieldError] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, emptySubmitted, fieldError]);

  const submit = async () => {
    if (!window.arc?.completeLibraryWrapMigration || busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setEmptySubmitted(true);
      setFieldError(true);
      return;
    }
    setBusy(true);
    setFieldError(false);
    try {
      const res = await window.arc.completeLibraryWrapMigration(trimmed);
      if (!res.ok) {
        setFieldError(true);
        return;
      }
      invalidateLibraryCache();
      window.dispatchEvent(new CustomEvent('arc:library-changed'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const nameInvalid = (emptySubmitted && !name.trim()) || fieldError;

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="library-wrap-migration-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcLibraryWrapMigrationTitle"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcLibraryWrapMigrationTitle">
              Название библиотеки
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
              <p className="arc-modal__slot-text">
                Укажите имя для вашей библиотеки внутри папки «Библиотека ARC»
              </p>
            </div>
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
                      void submit();
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
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
              <button type="button" className="btn btn-brand btn-ds btn-s" onClick={() => void submit()} disabled={busy}>
                <span className="btn-ds__value">{busy ? '…' : 'Продолжить'}</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
