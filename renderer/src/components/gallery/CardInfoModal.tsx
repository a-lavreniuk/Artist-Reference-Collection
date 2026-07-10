import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { ArcAnimatedModalHost } from '../../motion';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { formatBytes, formatResolution } from './cardFileMetaFormat';

type Props = {
  card: CardRecord;
  onClose: () => void;
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

type InfoRow = {
  label: string;
  value: string;
};

function InfoRows({ rows }: { rows: InfoRow[] }) {
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

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [card.id]);

  const fileRows: InfoRow[] = [
    { label: 'Разрешение', value: formatResolution(card) },
    { label: 'Вес', value: formatBytes(card.fileSize) },
    { label: 'Тип', value: card.format?.toUpperCase() ?? '—' }
  ];

  const dateRows: InfoRow[] = [
    { label: 'Дата создания', value: formatDate(card.fileCreatedAt) },
    { label: 'Дата добавления', value: formatDate(card.addedAt) },
    { label: 'Дата изменения', value: formatDate(card.dateModified) }
  ];

  return (
    <ArcAnimatedModalHost
      onClose={onClose}
      hostClassName="arc-modal-host--nested arc-modal-host--card-detail-nested"
    >
      {({ requestClose }) => (
        <section
          ref={hostRef}
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
            <div className="arc-modal__slot">
              <InfoRows rows={fileRows} />
            </div>
            <div className="arc-modal__slot">
              <hr className="arc-modal__separator" />
            </div>
            <div className="arc-modal__slot">
              <InfoRows rows={dateRows} />
            </div>
          </div>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
