import type { KeyboardEvent } from 'react';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import { formatInfoDate } from './cardFileMetaFormat';
import { formatVideoClock } from './cardDetailVideoTime';

type Props = {
  annotations: CardAnnotationV1[];
  selectedId: string | null;
  isVideo: boolean;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function CardDetailAnnotationsSection({
  annotations,
  selectedId,
  isVideo,
  readOnly = false,
  onSelect,
  onDelete
}: Props) {
  if (!annotations.length) return null;

  const onRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <ul className="arc-card-detail-annot-list">
      {annotations.map((annot, index) => {
        const date = formatInfoDate(annot.createdAt);
        const clock =
          isVideo && annot.timeMs != null ? formatVideoClock(annot.timeMs / 1000) : null;
        return (
          <li
            key={annot.id}
            className={[
              'arc-card-detail-annot-item',
              'arc-card-detail-collection-row',
              'arc-card-detail-collection-row--navigable',
              'panel',
              'elevation-sunken',
              selectedId === annot.id ? 'is-selected' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            data-annot-item=""
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!readOnly) onSelect(annot.id);
            }}
            onKeyDown={(event) => onRowKeyDown(event, annot.id)}
          >
            <div className="arc-card-detail-collection-main">
              <p className="text-l arc-card-detail-annot-item__text">
                {annot.text.trim() || 'Без текста'}
              </p>
              <div className="arc-card-detail-collection-meta">
                <span className="text-s arc-card-detail-annot-item__facts">
                  <span>#{index + 1}</span>
                  {date ? <span>{date}</span> : null}
                  {clock ? <span>Таймкод {clock}</span> : null}
                </span>
                {readOnly ? null : (
                  <button
                    type="button"
                    className="text-s arc-card-detail-collection-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(annot.id);
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
