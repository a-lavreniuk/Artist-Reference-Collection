import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import { formatInfoDate } from './cardFileMetaFormat';
import { formatVideoClock } from './cardDetailVideoTime';
import { positionAnnotationFloatingPanel } from './cardDetailAnnotationPeekPosition';

type Props = {
  anchorKey: string;
  numbers: number[];
  annotations: CardAnnotationV1[];
  isVideo: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
};

export default function CardDetailAnnotationPeek({
  anchorKey,
  numbers,
  annotations,
  isVideo,
  onOpen,
  onClose
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let raf = 0;
    const tick = () => {
      positionAnnotationFloatingPanel(panel, anchorKey);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchorKey, annotations]);

  const primary = annotations[0];
  if (!primary) return null;

  const date = formatInfoDate(primary.createdAt);
  const clock =
    isVideo && primary.timeMs != null ? formatVideoClock(primary.timeMs / 1000) : null;
  const label = numbers.length > 1 ? `#${numbers.join(', #')}` : `#${numbers[0]}`;

  return createPortal(
    <div
      ref={panelRef}
      className="arc-card-detail-annot-peek panel elevation-raised"
      data-elevation="raised"
      onMouseLeave={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="arc-card-detail-annot-peek__meta text-s">
        <span>{label}</span>
        {date ? <span>{date}</span> : null}
        {clock ? <span>{clock}</span> : null}
      </div>
      {annotations.length === 1 ? (
        <button
          type="button"
          className="arc-card-detail-annot-peek__body text-m"
          onClick={() => onOpen(primary.id)}
        >
          {primary.text.trim() || 'Без текста'}
        </button>
      ) : (
        <ul className="arc-card-detail-annot-peek__list">
          {annotations.map((annot, index) => (
            <li key={annot.id}>
              <button
                type="button"
                className="arc-card-detail-annot-peek__item text-m"
                onClick={() => onOpen(annot.id)}
              >
                <span className="text-s arc-card-detail-annot-peek__item-num">#{numbers[index]}</span>
                <span>{annot.text.trim() || 'Без текста'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );
}
