import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import { hydrateArcNavbarIcons } from '../../components/layout/navbarIconHydrate';

type Props = {
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmClearHistoryModal({ onClose, onConfirm }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [busy]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <ArcAnimatedModalHost onClose={onClose} hostClassName="arc-navbar-no-drag">
      {({ requestClose }) => (
        <section
          ref={hostRef}
          className="arc-modal"
          data-elevation="raised"
          data-input-size="s"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcClearHistoryTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcClearHistoryTitle">
              Очистить историю?
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                Все записи журнала будут удалены. Это действие нельзя отменить.
              </p>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button
              type="button"
              className="btn btn-danger btn-ds btn-s"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              <span className="btn-ds__value">{busy ? 'Очистка…' : 'Очистить'}</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" disabled={busy} onClick={requestClose}>
                <span className="btn-ds__value">Отмена</span>
              </button>
            </div>
          </footer>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
