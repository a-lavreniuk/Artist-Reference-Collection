import { useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import GalleryThumb from './GalleryThumb';
import { gallerySkeletonStyle } from './gallerySkeleton';
import { cardFileFormatLabel } from '../../utils/cardFileFormatLabel';

type Props = {
  card: CardRecord;
  src: string | null | undefined;
  onPick: () => void;
  onFindSimilar?: (cardId: string) => void;
  inMoodboard?: boolean;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export default function CardDetailSimilarThumb({
  card,
  src,
  onPick,
  onFindSimilar,
  inMoodboard = false,
  onToggleMoodboard,
  onContextMenu
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const moodboardEnabled = Boolean(onToggleMoodboard);

  const bookmarkIconClass = isBookmarkHovered
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';
  const mediaTypeIconClass = card.type === 'video' ? 'arc-icon-play' : 'arc-icon-image';
  const formatLabel = cardFileFormatLabel(card);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [card.id, inMoodboard, isBookmarkHovered, src]);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      className={`arc-gallery-card-wrap arc-card-similar-tile panel elevation-sunken${inMoodboard ? ' is-in-moodboard' : ''}`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span className="arc-gallery-card-stack">
        <span
          className={`arc-gallery-card-badge${formatLabel ? '' : ' arc-gallery-card-badge--icon-only'}`}
          data-btn-size="s"
        >
          <span className={`tab-icon ${mediaTypeIconClass}`} data-arc-icon-size="s" aria-hidden="true" />
          {formatLabel ? <span className="text-s arc-gallery-card-badge-label">{formatLabel}</span> : null}
        </span>
        {src ? (
          <GalleryThumb card={card} src={src} />
        ) : (
          <div className="arc-gallery-skeleton arc-card-similar-skeleton" style={gallerySkeletonStyle(card)} aria-hidden />
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
            {moodboardEnabled ? (
              <Tooltip content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'} position="top">
                <button
                  type="button"
                  tabIndex={-1}
                  className="btn btn-outline btn-icon-only btn-ds arc-gallery-overlay-bookmark arc-card-slot-blur-btn"
                  aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void onToggleMoodboard!(card.id);
                  }}
                >
                  <span className={`btn-icon-only__glyph ${bookmarkIconClass}`} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </span>
        </span>
      </span>
    </div>
  );
}
