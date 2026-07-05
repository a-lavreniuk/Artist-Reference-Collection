import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import { hydrateArcNavbarIcons } from '../../components/layout/navbarIconHydrate';

type Props = {
  pathLabel: string;
  onLeave: () => void;
  onTrash: () => void;
  onOpenInExplorer: () => void;
};

export default function OldFolderModal({ pathLabel, onLeave, onTrash, onOpenInExplorer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [pathLabel]);

  return (
    <ArcAnimatedModalHost onClose={onLeave}>
      {({ requestClose }) => (
        <section
          ref={hostRef}
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcOldFolderTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcOldFolderTitle">
              Старая папка библиотеки
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                Перенос завершён. Папка: <code className="text-m">{pathLabel}</code>
              </p>
              <p className="arc-modal__slot-text hint">Что сделать со старой папкой на диске?</p>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button type="button" className="btn btn-danger btn-ds btn-s" onClick={onTrash}>
              <span className="btn-ds__value">Удалить</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onOpenInExplorer}>
                <span className="btn-ds__value">Открыть в проводнике</span>
              </button>
              <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onLeave}>
                <span className="btn-ds__value">Оставить</span>
              </button>
            </div>
          </footer>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
