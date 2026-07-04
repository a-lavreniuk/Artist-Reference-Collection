import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  fileCount: number;
  onKeep: () => void;
  onTrashSources: () => void;
};

export default function SourceFilesModal({ fileCount, onKeep, onTrashSources }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [fileCount]);

  return (
    <ArcAnimatedModalHost onClose={onKeep} hostClassName="arc-modal-host--nested">
      {({ requestClose }) => (
        <section
          ref={hostRef}
          className="arc-modal"
          data-elevation="raised"
          data-input-size="s"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcSourceFilesTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcSourceFilesTitle">
              Что делать с исходниками?
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                {fileCount === 1
                  ? 'Файл скопирован в библиотеку. Исходник остался на диске.'
                  : `${fileCount} файлов скопированы в библиотеку. Исходники остались на диске.`}
              </p>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Ничего не делать</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-danger btn-ds btn-s" onClick={onTrashSources}>
                <span className="btn-ds__value">Удалить исходники</span>
              </button>
            </div>
          </footer>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
