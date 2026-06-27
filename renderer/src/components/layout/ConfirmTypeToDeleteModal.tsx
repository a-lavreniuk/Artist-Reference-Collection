import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

export type ConfirmTypeToDeleteModalProps = {
  title: string;
  message: string;
  confirmName: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  titleId: string;
  hostClassName?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmTypeToDeleteModal({
  title,
  message,
  confirmName,
  inputPlaceholder,
  confirmLabel = 'Удалить',
  busyConfirmLabel,
  titleId,
  hostClassName,
  onClose,
  onConfirm
}: ConfirmTypeToDeleteModalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatchSubmitted, setMismatchSubmitted] = useState(false);

  const isMatch = input === confirmName;
  const fieldDanger = mismatchSubmitted && !isMatch;
  const busyLabel = busyConfirmLabel ?? `${confirmLabel}…`;

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [busy, input, mismatchSubmitted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const handleConfirm = async () => {
    if (busy) return;
    if (!isMatch) {
      setMismatchSubmitted(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      ref={hostRef}
      className={['arc-modal-host', hostClassName].filter(Boolean).join(' ')}
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id={titleId}>
            {title}
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">{message}</p>
            <label
              className={`field input-live${input ? ' has-value' : ''}${fieldDanger ? ' field-error' : ''}`}
              data-live-input
            >
              <input
                className="input"
                type="text"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setMismatchSubmitted(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleConfirm();
                  }
                }}
                placeholder={inputPlaceholder ?? confirmName}
                aria-invalid={fieldDanger || undefined}
                autoFocus
              />
            </label>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-3">
          <button
            type="button"
            className="btn btn-danger btn-ds btn-s"
            disabled={busy || !isMatch}
            onClick={() => void handleConfirm()}
          >
            <span className="btn-ds__value">{busy ? busyLabel : confirmLabel}</span>
          </button>
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds btn-s" disabled={busy} onClick={onClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
