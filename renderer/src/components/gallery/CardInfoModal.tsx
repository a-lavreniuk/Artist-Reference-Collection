import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { buildCardInfoSections, type CardInfoRow } from './cardFileMetaFormat';

type Props = {
  card: CardRecord;
  onClose: () => void;
};

function InfoRows({ rows }: { rows: CardInfoRow[] }) {
  return (
    <div className="arc-card-info-group">
      {rows.map((row) => (
        <div key={row.label} className="arc-card-info-row">
          <span className="arc-card-info-row__label text-m">{row.label}</span>
          <span className="arc-card-info-row__value text-m">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CardInfoModal({ card, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [displayCard, setDisplayCard] = useState(card);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [displayCard.id, displayCard.mediaMeta?.probedAt]);

  useEffect(() => {
    setDisplayCard((prev) => {
      if (card.id !== prev.id) return card;
      if (card.mediaMeta?.probedAt) return card;
      if (prev.mediaMeta?.probedAt) return { ...card, mediaMeta: prev.mediaMeta };
      return card;
    });
  }, [card]);

  useEffect(() => {
    let cancelled = false;
    const ensure = window.arc?.storageEnsureCardMediaMeta;
    if (!ensure) return;
    if (displayCard.mediaMeta?.probedAt) return;

    void (async () => {
      try {
        const enriched = await ensure(card.id);
        if (!cancelled && enriched) {
          setDisplayCard((prev) => {
            if (prev.id !== card.id) return prev;
            return { ...prev, ...enriched, mediaMeta: enriched.mediaMeta ?? prev.mediaMeta };
          });
        }
      } catch {
        /* ignore: show base fields */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card.id, displayCard.mediaMeta?.probedAt]);

  const sections = buildCardInfoSections(displayCard);

  return (
    <ArcAnimatedModalHost
      onClose={onClose}
      hostClassName="arc-modal-host--nested arc-modal-host--card-detail-nested"
    >
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="card-info-modal"
          className="arc-modal arc-card-info-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="m"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcCardInfoTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcCardInfoTitle">
              Информация о файле
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            {sections.map((rows, idx) => (
              <div key={rows[0]?.label ?? idx}>
                {idx > 0 ? (
                  <div className="arc-modal__slot">
                    <hr className="arc-modal__separator" />
                  </div>
                ) : null}
                <div className="arc-modal__slot">
                  <InfoRows rows={rows} />
                </div>
              </div>
            ))}
          </div>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
