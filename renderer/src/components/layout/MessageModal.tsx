import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type Props = {
  title?: string;
  message: string;
  onClose: () => void;
  /** Подпись основной кнопки */
  closeLabel?: string;
  /** Дополнительные классы для корня (например вложенная модалка поверх другой) */
  hostClassName?: string;
};

export default function MessageModal({
  title = 'Сообщение',
  message,
  onClose,
  closeLabel = 'Понятно',
  hostClassName = ''
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [message, title]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={hostRef}
      className={`arc-modal-host${hostClassName ? ` ${hostClassName}` : ''}`}
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
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
        aria-labelledby="arcMessageModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcMessageModalTitle">
            {title}
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">{message}</p>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-1">
          <button type="button" className="btn btn-primary btn-ds btn-s" onClick={onClose}>
            <span className="btn-ds__value">{closeLabel}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
