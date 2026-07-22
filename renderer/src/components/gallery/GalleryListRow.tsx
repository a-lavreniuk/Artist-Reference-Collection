import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardRecord } from '../../services/db';
import {
  formatBytes,
  formatInfoDate,
  formatResolution
} from './cardFileMetaFormat';
import { galleryCardDisplayName } from './galleryCardDisplayName';
import GalleryThumb from './GalleryThumb';
import { GALLERY_LIST_ROW_HEIGHT_PX, GALLERY_LIST_THUMB_SIZE_PX } from './galleryListConstants';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { TruncatedTextWithTooltip } from '../tooltip/TruncatedTextWithTooltip';

type Props = {
  card: CardRecord;
  thumbSrc?: string;
  isSelected?: boolean;
  inMoodboard?: boolean;
  moodboardEnabled?: boolean;
  onCardClick: (cardId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenInNewWindow?: (cardId: string) => void;
  onCardPointerDown?: (cardId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onFindSimilar?: (cardId: string) => void;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
  interfaceTourAnchor?: string;
};

function GalleryListRow({
  card,
  thumbSrc,
  isSelected = false,
  inMoodboard = false,
  moodboardEnabled = false,
  onCardClick,
  onOpenInNewWindow,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  onFindSimilar,
  onToggleMoodboard,
  onContextMenu,
  mediaTab,
  interfaceTourAnchor
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [hoveredBookmark, setHoveredBookmark] = useState(false);
  const name = galleryCardDisplayName(card);
  const resolution = formatResolution(card) ?? '—';
  const size = formatBytes(card.fileSize) ?? '—';
  const format = card.format ? card.format.toUpperCase() : '—';
  const addedAt = formatInfoDate(card.addedAt) ?? '—';
  const thumbStyle: CSSProperties = {
    width: GALLERY_LIST_THUMB_SIZE_PX,
    height: GALLERY_LIST_THUMB_SIZE_PX
  };
  const bookmarkIcon = hoveredBookmark
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';
  const showActions = Boolean((moodboardEnabled && onToggleMoodboard) || onFindSimilar);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [card.id, inMoodboard, hoveredBookmark, showActions]);

  return (
    <div
      ref={rootRef}
      className={`arc-gallery-list-row${isSelected ? ' is-selected' : ''}${focused ? ' is-focused' : ''}`}
      style={{ height: GALLERY_LIST_ROW_HEIGHT_PX }}
      role="button"
      tabIndex={0}
      data-gallery-card-id={card.id}
      data-interface-tour-anchor={interfaceTourAnchor}
      aria-label={name}
      onClick={(event) => onCardClick(card.id, event)}
      onDoubleClick={(event) => {
        if (!onOpenInNewWindow) return;
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenInNewWindow(card.id);
      }}
      onContextMenu={onContextMenu}
      onPointerDown={(event) => onCardPointerDown?.(card.id, event)}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onCardClick(card.id, event as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
    >
      <span className="arc-gallery-list-row__thumb" style={thumbStyle}>
        {thumbSrc ? (
          <GalleryThumb card={card} src={thumbSrc} mediaTab={mediaTab} fit="cover" />
        ) : (
          <span className="arc-gallery-list-row__thumb-empty" aria-hidden />
        )}
      </span>
      <TruncatedTextWithTooltip
        text={name}
        className="arc-gallery-list-row__name text-m"
        wrapClassName="arc-gallery-list-row__name-wrap arc-truncated-tooltip-wrap"
      />
      <span className="arc-gallery-list-row__meta text-m">{resolution}</span>
      <span className="arc-gallery-list-row__meta text-m">{size}</span>
      <span className="arc-gallery-list-row__meta text-m">{format}</span>
      <span className="arc-gallery-list-row__meta text-m">{addedAt}</span>
      <span
        className="arc-gallery-list-row__actions arc-ui-kit-scope"
        data-btn-size="s"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {moodboardEnabled && onToggleMoodboard ? (
          <button
            type="button"
            className="btn btn-outline btn-ds"
            aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
            onMouseEnter={() => setHoveredBookmark(true)}
            onMouseLeave={() => setHoveredBookmark(false)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onToggleMoodboard(card.id);
            }}
          >
            <span className={`btn-ds__icon ${bookmarkIcon}`} aria-hidden="true" />
            <span className="btn-ds__value">
              {inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
            </span>
          </button>
        ) : null}
        {onFindSimilar ? (
          <button
            type="button"
            className="btn btn-outline btn-ds"
            aria-label="Найти похожее"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onFindSimilar(card.id);
            }}
          >
            <span className="btn-ds__icon arc-icon-search" aria-hidden="true" />
            <span className="btn-ds__value">Найти похожее</span>
          </button>
        ) : null}
      </span>
    </div>
  );
}

function propsEqual(prev: Props, next: Props): boolean {
  return (
    prev.card.id === next.card.id &&
    prev.card.name === next.card.name &&
    prev.card.format === next.card.format &&
    prev.card.fileSize === next.card.fileSize &&
    prev.card.width === next.card.width &&
    prev.card.height === next.card.height &&
    prev.card.addedAt === next.card.addedAt &&
    prev.thumbSrc === next.thumbSrc &&
    prev.isSelected === next.isSelected &&
    prev.inMoodboard === next.inMoodboard &&
    prev.moodboardEnabled === next.moodboardEnabled &&
    prev.onCardClick === next.onCardClick &&
    prev.onOpenInNewWindow === next.onOpenInNewWindow &&
    prev.onCardPointerDown === next.onCardPointerDown &&
    prev.onCardPointerMove === next.onCardPointerMove &&
    prev.onCardPointerUp === next.onCardPointerUp &&
    prev.onFindSimilar === next.onFindSimilar &&
    prev.onToggleMoodboard === next.onToggleMoodboard &&
    prev.onContextMenu === next.onContextMenu &&
    prev.mediaTab === next.mediaTab
  );
}

export default memo(GalleryListRow, propsEqual);
