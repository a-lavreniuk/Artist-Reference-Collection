import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import GalleryThumb from './GalleryThumb';
import { gallerySkeletonStyle } from './gallerySkeleton';
import { cardFileFormatLabel } from '../../utils/cardFileFormatLabel';

type Props = {
  card: CardRecord;
  thumbSrc?: string;
  inMoodboard?: boolean;
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  moodboardEnabled?: boolean;
  tileClassName?: string;
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
};

function GalleryCardTile({
  card,
  thumbSrc,
  inMoodboard = false,
  onOpenCard,
  onFindSimilar,
  onToggleMoodboard,
  moodboardEnabled = false,
  tileClassName = '',
  mediaTab
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoveredBookmarkCardId, setHoveredBookmarkCardId] = useState(false);

  const iconClass = hoveredBookmarkCardId
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';
  const mediaTypeIconClass = card.type === 'video' ? 'arc-icon-play' : 'arc-icon-image';
  const formatLabel = cardFileFormatLabel(card);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [card.id, inMoodboard, hoveredBookmarkCardId, thumbSrc]);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      className={`arc-gallery-card-wrap panel elevation-default${inMoodboard ? ' is-in-moodboard' : ''}${tileClassName ? ` ${tileClassName}` : ''}`}
      onClick={() => onOpenCard(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenCard(card.id);
        }
      }}
    >
      <span className="arc-gallery-card-stack">
        <span
          className={`arc-gallery-card-badge${formatLabel ? '' : ' arc-gallery-card-badge--icon-only'}`}
          data-btn-size="s"
        >
          <span className={`tab-icon ${mediaTypeIconClass}`} data-arc-icon-size="s" aria-hidden="true" />
          {formatLabel ? <span className="arc-gallery-card-badge-label">{formatLabel}</span> : null}
        </span>
        {thumbSrc ? (
          <GalleryThumb card={card} src={thumbSrc} mediaTab={mediaTab} />
        ) : (
          <div className="arc-gallery-skeleton" style={gallerySkeletonStyle(card)} aria-hidden />
        )}
        <span className="arc-gallery-card-overlay">
          <span className="arc-gallery-card-overlay-inner" data-btn-size="s">
            {onFindSimilar ? (
              <button
                type="button"
                tabIndex={-1}
                className="btn btn-secondary btn-ds arc-gallery-overlay-btn arc-card-slot-blur-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFindSimilar(card.id);
                }}
              >
                <span className="btn-ds__icon arc-icon-search" aria-hidden="true" />
                <span className="btn-ds__value">Найти похожее</span>
              </button>
            ) : null}
            {moodboardEnabled && onToggleMoodboard ? (
              <Tooltip
                content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                position="top"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className="btn btn-outline btn-icon-only btn-ds arc-gallery-overlay-bookmark arc-card-slot-blur-btn"
                  aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                  onMouseEnter={() => setHoveredBookmarkCardId(true)}
                  onMouseLeave={() => setHoveredBookmarkCardId(false)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void onToggleMoodboard(card.id);
                  }}
                >
                  <span className={`btn-icon-only__glyph ${iconClass}`} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </span>
        </span>
      </span>
    </div>
  );
}

function galleryCardTilePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.card.id === next.card.id &&
    prev.card.type === next.card.type &&
    prev.thumbSrc === next.thumbSrc &&
    prev.inMoodboard === next.inMoodboard &&
    prev.moodboardEnabled === next.moodboardEnabled &&
    prev.tileClassName === next.tileClassName &&
    prev.onOpenCard === next.onOpenCard &&
    prev.onFindSimilar === next.onFindSimilar &&
    prev.onToggleMoodboard === next.onToggleMoodboard &&
    prev.mediaTab === next.mediaTab
  );
}

export default memo(GalleryCardTile, galleryCardTilePropsEqual);
