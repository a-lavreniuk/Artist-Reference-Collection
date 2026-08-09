import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { pluralFilesRu } from '../../import/importQueue';

type Props = {
  addedCount: number;
  onKeep: () => void;
  onDelete: () => void;
};

/** После отмены импорта: оставить уже добавленные карточки или убрать в корзину. */
export default function ImportCancelKeepModal({ addedCount, onKeep, onDelete }: Props) {
  const hostRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [addedCount]);

  const word = pluralFilesRu(addedCount);

  return (
    <ArcAnimatedModalHost onClose={onKeep} hostClassName="arc-modal-host--nested">
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="import-cancel-keep-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcImportCancelKeepTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcImportCancelKeepTitle">
              Импорт отменён
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                Успели добавить {addedCount} {word}. Оставить в библиотеке или удалить?
              </p>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Оставить</span>
            </button>
            <div className="arc-modal__footer-right">
              <button
                type="button"
                className="btn btn-danger btn-ds btn-s"
                onClick={() => {
                  onDelete();
                }}
              >
                <span className="btn-ds__value">Удалить</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
