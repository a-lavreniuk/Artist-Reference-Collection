import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  /** Карточка стоит на доске — расширенный текст предупреждения */
  cardOnBoard: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  hostClassName?: string;
};

export default function ConfirmRemoveFromMoodboardModal({ cardOnBoard, onClose, onConfirm, hostClassName = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [busy, cardOnBoard]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const message = cardOnBoard
    ? 'Карточка участвует в работе доски. Удаление снимет её из рабочей области.'
    : 'Снять карточку с мудборда?';

  return (
    <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="confirm-remove-from-moodboard-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="s"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcRemoveMoodboardTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcRemoveMoodboardTitle">
              Мудборд
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">{message}</p>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button
              type="button"
              className="btn btn-danger btn-ds btn-s"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              <span className="btn-ds__value">{busy ? 'Снятие…' : 'Снять с мудборда'}</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" disabled={busy} onClick={requestClose}>
                <span className="btn-ds__value">Отмена</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
