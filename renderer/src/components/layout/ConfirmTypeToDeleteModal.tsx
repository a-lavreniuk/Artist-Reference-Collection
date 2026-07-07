import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
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
    <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
      {({ requestClose }) => (
        <section
          ref={hostRef}
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
            <button
              type="button"
              className="arc-modal__close"
              aria-label="Закрыть"
              disabled={busy}
              onClick={() => {
                if (!busy) requestClose();
              }}
            >
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
              className="btn btn-outline btn-ds btn-s"
              disabled={busy}
              onClick={() => {
                if (!busy) requestClose();
              }}
            >
              <span className="btn-ds__value">Отмена</span>
            </button>
            <div className="arc-modal__footer-right">
              <button
                type="button"
                className="btn btn-danger btn-ds btn-s"
                disabled={busy || !isMatch}
                onClick={() => void handleConfirm()}
              >
                <span className="btn-ds__value">{busy ? busyLabel : confirmLabel}</span>
              </button>
            </div>
          </footer>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
