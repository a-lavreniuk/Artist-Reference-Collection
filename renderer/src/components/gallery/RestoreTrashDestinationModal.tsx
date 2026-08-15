import { useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import SettingsRadioRow from '../settings/SettingsRadioRow';
import type { LibraryListItem } from '../../hooks/useLibraries';

type Props = {
  libraries: LibraryListItem[];
  onClose: () => void;
  onConfirm: (destinationLibraryId: string) => Promise<void>;
  hostClassName?: string;
};

export default function RestoreTrashDestinationModal({
  libraries,
  onClose,
  onConfirm,
  hostClassName
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [destinationId, setDestinationId] = useState(libraries[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [busy, destinationId]);

  const canRestore = Boolean(destinationId) && !busy;

  const handleConfirm = async () => {
    if (!canRestore) return;
    setBusy(true);
    try {
      await onConfirm(destinationId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="restore-trash-destination-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="s"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcRestoreTrashDestTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcRestoreTrashDestTitle">
              Восстановить карточку?
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                Исходная библиотека недоступна. Выберите библиотеку, куда вернуть карточку.
              </p>
              <div className="arc-restore-trash-dest-list">
                {libraries.map((lib) => (
                  <SettingsRadioRow
                    key={lib.id}
                    label={lib.name}
                    checked={destinationId === lib.id}
                    disabled={busy}
                    onCheckedChange={() => setDestinationId(lib.id)}
                  />
                ))}
              </div>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              disabled={!canRestore}
              onClick={() => void handleConfirm()}
            >
              <span className="btn-ds__value">{busy ? 'Восстановление…' : 'Восстановить'}</span>
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
