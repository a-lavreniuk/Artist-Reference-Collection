import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

export type ReleaseNotesData = {
  version: string;
  buildDate: string;
  changes: string[];
};

type Props = {
  data: ReleaseNotesData;
  onClose: () => void;
};

function formatBuildDate(isoDate: string): string {
  const parts = isoDate.trim().split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }
  return isoDate;
}

export default function ReleaseNotesModal({ data, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="arc-modal arc-release-notes-modal"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcReleaseNotesTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title-subtitle">
          <div className="arc-modal__title-block">
            <h3 className="arc-modal__title" id="arcReleaseNotesTitle">
              Версия {data.version}
            </h3>
            <p className="arc-modal__subtitle">Сборка от {formatBuildDate(data.buildDate)}</p>
          </div>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <ul className="arc-release-notes-list">
              {data.changes.map((line) => (
                <li key={line} className="arc-release-notes-list__item">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-1">
          <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onClose}>
            <span className="btn-ds__value">Понятно</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
