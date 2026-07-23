import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from './FloatingModalPanel';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { invalidateLibraryCache } from '../../services/db';

type Props = {
  onComplete: () => void;
};

function isNameFieldError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('Некорректное имя') ||
    message.includes('таким именем уже есть') ||
    message.includes('Некорректное имя библиотеки')
  );
}

export default function LibraryWrapMigrationModal({ onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('Основная');
  const [busy, setBusy] = useState(false);
  const [emptySubmitted, setEmptySubmitted] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  /** Ошибки миграции/диска — не валидация имени. */
  const [systemError, setSystemError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, emptySubmitted, fieldError, systemError]);

  const submit = async () => {
    if (!window.arc?.completeLibraryWrapMigration || busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setEmptySubmitted(true);
      setFieldError(true);
      setSystemError(null);
      return;
    }
    setBusy(true);
    setFieldError(false);
    setSystemError(null);
    try {
      const res = await window.arc.completeLibraryWrapMigration(trimmed);
      if (!res.ok) {
        if (isNameFieldError(res.error)) {
          setFieldError(true);
        } else {
          setSystemError(res.error?.trim() || 'Не удалось выполнить миграцию');
        }
        return;
      }
      invalidateLibraryCache();
      window.dispatchEvent(new CustomEvent('arc:library-changed'));
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  const nameInvalid = (emptySubmitted && !name.trim()) || fieldError;

  return (
    <ArcAnimatedModalHost onClose={() => undefined} closeDisabled>
      {() => (
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
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                Укажите имя для вашей библиотеки внутри папки «Библиотека ARC». Это обязательный шаг — без него
                приложение не сможет работать с текущей папкой.
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
                    setSystemError(null);
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
            {systemError ? (
              <div className="arc-modal__slot">
                <p className="text-s hint" role="alert">
                  {systemError}
                </p>
              </div>
            ) : null}
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <div className="arc-modal__footer-right">
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
