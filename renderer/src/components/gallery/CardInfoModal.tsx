import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  card: CardRecord;
  onClose: () => void;
};

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Кб`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Мб`;
}

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

function formatResolution(card: CardRecord): string {
  if (card.width && card.height) return `${card.width}×${card.height}`;
  return '—';
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
    <div
      ref={hostRef}
      className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
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
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
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
    </div>
  );
}
