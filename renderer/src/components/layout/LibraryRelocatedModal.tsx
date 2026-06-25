import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { invalidateLibraryCache } from '../../services/db';

type Props = {
  onClose: () => void;
};

export default function LibraryRelocatedModal({ onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const pickFolder = useCallback(async () => {
    if (!window.arc || busy) return;
    setFieldError(false);
    const picked = await window.arc.pickLibraryFolder();
    if (!picked) return;

    setBusy(true);
    try {
      const validation = await window.arc.validateLibraryFolder(picked);
      if (!validation.valid) {
        setFieldError(true);
        return;
      }
      const res = await window.arc.relinkLibraryFolder(picked);
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
        aria-labelledby="arcLibraryRelocatedTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcLibraryRelocatedTitle">
            Вы перенесли папку?
          </h3>
          <button
            type="button"
            className="arc-modal__close"
            aria-label="Закрыть"
            onClick={onClose}
            disabled={busy}
          >
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className={`arc-modal__slot${fieldError ? ' field-error' : ''}`}>
            <p className="arc-modal__slot-text">
              ARC не видит прежние файлы библиотеки, а в истории нет записей об удалении. Укажите
              актуальную папку библиотеки на диске.
            </p>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose} disabled={busy}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button type="button" className="btn btn-brand btn-ds btn-s" onClick={() => void pickFolder()} disabled={busy}>
            <span className="btn-ds__value">{busy ? '…' : 'Указать папку'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
