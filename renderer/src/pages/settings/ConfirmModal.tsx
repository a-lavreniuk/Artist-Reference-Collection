import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../../components/layout/navbarIconHydrate';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Отмена',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [title, message]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const confirmClass = confirmVariant === 'danger' ? 'btn btn-danger btn-ds btn-s' : 'btn btn-primary btn-ds btn-s';

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcConfirmTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcConfirmTitle">
            {title}
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onCancel}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">{message}</p>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onCancel}>
            <span className="btn-ds__value">{cancelLabel}</span>
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm}>
            <span className="btn-ds__value">{confirmLabel}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
