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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  iconClass: string;
  label: string;
  value: string;
};

export default function CardInfoModal({ card, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [card.id]);

  const rows: InfoRow[] = [
    { iconClass: 'arc-icon-resolution', label: 'Разрешение', value: formatResolution(card) },
    { iconClass: 'arc-icon-weight', label: 'Размер файла', value: formatBytes(card.fileSize) },
    { iconClass: 'arc-icon-file-type', label: 'Тип файла', value: card.format?.toUpperCase() ?? '—' },
    { iconClass: 'arc-icon-calendar', label: 'Создание файла', value: formatDate(card.fileCreatedAt) },
    { iconClass: 'arc-icon-calendar', label: 'Добавлено в ARC', value: formatDate(card.addedAt) },
    { iconClass: 'arc-icon-history', label: 'Изменение карточки', value: formatDate(card.dateModified) }
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
            Информация
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <ul className="arc-card-info-list">
            {rows.map((row) => (
              <li key={row.label} className="arc-card-info-row">
                <span className={`arc-card-info-row__icon ${row.iconClass}`} aria-hidden="true" />
                <span className="arc-card-info-row__label text-m">{row.label}</span>
                <span className="arc-card-info-row__value text-m">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
