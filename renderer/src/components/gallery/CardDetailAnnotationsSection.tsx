import type { KeyboardEvent, MouseEvent } from 'react';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import { InfoSplitCard } from '../info-card';
import { formatInfoDate } from './cardFileMetaFormat';
import { formatVideoClock } from './cardDetailVideoTime';

type Props = {
  annotations: CardAnnotationV1[];
  hoveredId: string | null;
  focusedId: string | null;
  isVideo: boolean;
  readOnly?: boolean;
  compact?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
};

function blurAnnotRow(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
  event.currentTarget.blur();
}

export default function CardDetailAnnotationsSection({
  annotations,
  hoveredId,
  focusedId,
  isVideo,
  readOnly = false,
  compact = false,
  onSelect,
  onHover,
  onDelete
}: Props) {
  if (!annotations.length) return null;

  const onRowKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
      blurAnnotRow(event);
    }
  };

  return (
    <ul className="arc-card-detail-annot-list arc-info-card-list">
      {annotations.map((annot, index) => {
        const date = formatInfoDate(annot.createdAt);
        const clock =
          isVideo && annot.timeMs != null ? formatVideoClock(annot.timeMs / 1000) : null;
        const highlighted = hoveredId === annot.id || focusedId === annot.id;
        return (
          <li key={annot.id} className="arc-card-detail-annot-item" data-annot-item="">
            <InfoSplitCard
              interactive={!readOnly}
              compact={compact}
              highlighted={highlighted}
              className={[
                hoveredId === annot.id ? 'is-hovered' : '',
                focusedId === annot.id ? 'is-focused' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              role="button"
              tabIndex={0}
              title={annot.text.trim() || 'Без текста'}
              chips={
                <>
                  <span className="chip">#{index + 1}</span>
                  {date ? <span className="chip">{date}</span> : null}
                  {clock ? <span className="chip">{clock} таймкод</span> : null}
                </>
              }
              actions={
                readOnly ? null : (
                  <button
                    type="button"
                    className="btn btn-danger btn-ds"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(annot.id);
                    }}
                  >
                    <span className="btn-ds__value">Удалить</span>
                  </button>
                )
              }
              onMouseEnter={() => onHover(annot.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(event) => {
                if (readOnly) return;
                onSelect(annot.id);
                blurAnnotRow(event);
              }}
              onKeyDown={(event) => onRowKeyDown(event, annot.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
