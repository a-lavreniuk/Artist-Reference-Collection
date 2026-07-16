import { useLayoutEffect, useMemo, useRef } from 'react';
import ReleaseNotesContent from './ReleaseNotesContent';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from './FloatingModalPanel';
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

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="release-notes-modal"
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
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
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
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Продолжить</span>
            </button>
          </footer>
        ) : (
          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Продолжить</span>
            </button>
          </footer>
        )}
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
