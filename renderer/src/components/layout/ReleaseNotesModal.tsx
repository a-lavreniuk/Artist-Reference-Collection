import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ReleaseNotesContent from './ReleaseNotesContent';
import { getReleaseNotesPreviewChanges, hasMoreReleaseNotes } from './releaseNotesConstants';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

export type ReleaseNotesData = {
  version: string;
  buildDate: string;
  changes: string[];
};

type Props = {
  data: ReleaseNotesData;
  onClose: () => void;
  onDetails?: () => void;
};

export default function ReleaseNotesModal({ data, onClose, onDetails }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const previewChanges = useMemo(() => getReleaseNotesPreviewChanges(data.changes), [data.changes]);
  const showDetails = hasMoreReleaseNotes(data.changes) && onDetails != null;

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
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcReleaseNotesTitle">
            Что нового?
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot arc-release-notes-modal__slot">
            <ReleaseNotesContent
              version={data.version}
              buildDate={data.buildDate}
              changes={previewChanges}
            />
          </div>
        </div>
        {showDetails ? (
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-secondary btn-ds btn-s" onClick={onDetails}>
              <span className="btn-ds__value">Подробнее</span>
            </button>
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onClose}>
              <span className="btn-ds__value">Продолжить</span>
            </button>
          </footer>
        ) : (
          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onClose}>
              <span className="btn-ds__value">Продолжить</span>
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
