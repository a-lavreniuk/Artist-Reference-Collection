import type { KeyboardEvent, MouseEvent } from 'react';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import { formatInfoDate } from './cardFileMetaFormat';
import { formatVideoClock } from './cardDetailVideoTime';

type Props = {
  annotations: CardAnnotationV1[];
  activeId: string | null;
  hoveredId: string | null;
  focusedId: string | null;
  isVideo: boolean;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

function blurAnnotRow(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
  event.currentTarget.blur();
}

export default function CardDetailAnnotationsSection({
  annotations,
  activeId,
  hoveredId,
  focusedId,
  isVideo,
  readOnly = false,
  onSelect,
  onHover,
  onDelete,
  onDuplicate
}: Props) {
  if (!annotations.length) return null;

  const onRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
      blurAnnotRow(event);
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
              activeId === annot.id ? 'is-active' : '',
              hoveredId === annot.id ? 'is-hovered' : '',
              focusedId === annot.id ? 'is-focused' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            data-annot-item=""
            role="button"
            tabIndex={0}
            onMouseEnter={() => onHover(annot.id)}
            onMouseLeave={() => onHover(null)}
            onClick={(event) => {
              if (readOnly) return;
              onSelect(annot.id);
              blurAnnotRow(event);
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
                  <div className="arc-card-detail-annot-item-actions">
                    <button
                      type="button"
                      className="text-s arc-card-detail-collection-remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(annot.id);
                      }}
                    >
                      Дублировать
                    </button>
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
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
