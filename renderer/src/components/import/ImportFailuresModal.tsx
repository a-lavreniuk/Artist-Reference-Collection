import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { baseNameFromPath } from '../../import/importQueue';

export type ImportFailureItem = {
  path: string;
  error: string;
};

type Props = {
  failures: ImportFailureItem[];
  addedCount: number;
  onClose: () => void;
};

export default function ImportFailuresModal({ failures, addedCount, onClose }: Props) {
  const hostRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [failures.length]);

  const failed = failures.length;
  const title =
    addedCount > 0
      ? `Добавлено ${addedCount}, не удалось ${failed}`
      : failed === 1
        ? 'Не удалось добавить файл'
        : `Не удалось добавить ${failed} файлов`;

  return (
    <ArcAnimatedModalHost onClose={onClose} hostClassName="arc-modal-host--nested">
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="import-failures-modal"
          className="arc-modal arc-import-failures-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcImportFailuresTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcImportFailuresTitle">
              {title}
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-import-failures-modal__scroll">
              <ul className="arc-import-failures-modal__list">
                {failures.map((f) => (
                  <li key={f.path} className="arc-import-failures-modal__item">
                    <span className="arc-import-failures-modal__name text-m">{baseNameFromPath(f.path)}</span>
                    <span className="arc-import-failures-modal__error text-s">{f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Понятно</span>
            </button>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
