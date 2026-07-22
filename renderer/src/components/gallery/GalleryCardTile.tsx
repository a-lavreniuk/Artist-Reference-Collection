import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GridSize } from '../../layout/gridSizePreference';
import { readGridSize } from '../../layout/gridSizePreference';
import type { CardRecord } from '../../services/db';
import { useCardOverlayStagger } from '../../motion';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import GalleryThumb from './GalleryThumb';
import GalleryCardShade from './GalleryCardShade';
import GalleryCardVideoTimeline from './GalleryCardVideoTimeline';
import { galleryCardAspectRatio } from './gallerySkeleton';
import {
  galleryCardBtnSize,
  galleryCardOverlayStyleVars,
  minGalleryCardOverlayHeightPx
} from './galleryCardOverlayTokens';
import { useGalleryCardVideoHover } from './useGalleryCardVideoHover';
import { useGalleryCardOverlayTimeFit } from './useGalleryCardOverlayTimeFit';
import { formatVideoClock } from './cardDetailVideoTime';
import { cardFileFormatLabel } from '../../utils/cardFileFormatLabel';

type Props = {
  card: CardRecord;
  thumbSrc?: string;
  gridSize?: GridSize;
  inMoodboard?: boolean;
  isSelected?: boolean;
  onCardClick: (cardId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenInNewWindow?: (cardId: string) => void;
  onCardPointerDown?: (cardId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onFindSimilar?: (cardId: string) => void;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  moodboardEnabled?: boolean;
  tileClassName?: string;
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
  interfaceTourAnchor?: string;
  /** cover — квадратное превью с обрезкой (режим Grid). */
  thumbFit?: 'natural' | 'cover';
};

function GalleryCardTile({
  card,
  thumbSrc,
  gridSize: gridSizeProp,
  inMoodboard = false,
  isSelected = false,
  onCardClick,
  onOpenInNewWindow,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  onFindSimilar,
  onToggleMoodboard,
  onContextMenu,
  moodboardEnabled = false,
  tileClassName = '',
  mediaTab,
  interfaceTourAnchor,
  thumbFit = 'natural'
}: Props) {
  const gridSize = gridSizeProp ?? readGridSize();
  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLSpanElement>(null);
  const overlayInnerRef = useRef<HTMLSpanElement>(null);
  const overlayControlsRef = useRef<HTMLSpanElement>(null);
  const overlayBadgeRef = useRef<HTMLSpanElement>(null);
  const overlayTimeRef = useRef<HTMLSpanElement>(null);
  const overlayRightRef = useRef<HTMLSpanElement>(null);

  const [mouseHovered, setMouseHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hoveredBookmarkCardId, setHoveredBookmarkCardId] = useState(false);
  const [overlaySuppressed, setOverlaySuppressed] = useState(false);

  const isVideo = card.type === 'video';
  const minOverlayHeight = minGalleryCardOverlayHeightPx(gridSize, isVideo);
  const overlayIntent = mouseHovered || focused;
  const overlayActive = overlayIntent && !overlaySuppressed;

  useCardOverlayStagger(overlayActive, overlayInnerRef);

  const videoHover = useGalleryCardVideoHover({
    card,
    active: overlayIntent,
    suppressed: overlaySuppressed
  });

  const iconClass = hoveredBookmarkCardId
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';
  const mediaTypeIconClass = isVideo ? 'arc-icon-play' : 'arc-icon-image';
  const formatLabel = cardFileFormatLabel(card);
  const btnSize = galleryCardBtnSize(gridSize);
  const videoTimeCodeClass = gridSize === 's' ? 'text-code-s' : 'text-code-m';
  const overlayStyleVars = useMemo(() => galleryCardOverlayStyleVars(gridSize), [gridSize]);

  const durationMs = videoHover.durationMs || card.durationMs || 0;
  const videoTimeLabel = isVideo
    ? `${formatVideoClock(videoHover.currentMs / 1000)} / ${formatVideoClock(durationMs / 1000)}`
    : '';
  const showMoodboardAction = Boolean(moodboardEnabled && onToggleMoodboard);
  const showSimilarAction = Boolean(onFindSimilar);
  const hideOverlayTime = useGalleryCardOverlayTimeFit({
    enabled: isVideo && !overlaySuppressed,
    controlsRef: overlayControlsRef,
    badgeRef: overlayBadgeRef,
    timeRef: overlayTimeRef,
    rightRef: overlayRightRef,
    layoutKey: [
      gridSize,
      formatLabel ?? '',
      videoTimeLabel.length,
      showMoodboardAction ? '1' : '0',
      showSimilarAction ? '1' : '0',
      card.id
    ].join('|')
  });

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    const measure = () => {
      const height = stack.getBoundingClientRect().height;
      setOverlaySuppressed(height > 0 && height < minOverlayHeight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [minOverlayHeight, card.id, gridSize]);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [card.id, inMoodboard, hoveredBookmarkCardId, thumbSrc, overlayActive, formatLabel]);

  return (
    <div className={`arc-gallery-card-shell${isSelected ? ' is-selected' : ''}`}>
      <span className="arc-gallery-card-selection-ring" aria-hidden="true" />
      <div
        ref={rootRef}
        role="button"
        tabIndex={0}
        className={`arc-gallery-card-wrap panel elevation-default${inMoodboard ? ' is-in-moodboard' : ''}${overlaySuppressed ? ' arc-gallery-card-wrap--overlay-suppressed' : ''}${tileClassName ? ` ${tileClassName}` : ''}`}
      data-gallery-card-id={card.id}
      data-grid-size={gridSize}
      style={overlayStyleVars}
      {...(interfaceTourAnchor ? { 'data-interface-tour-anchor': interfaceTourAnchor } : {})}
      onClick={(event) => onCardClick(card.id, event)}
      onDoubleClick={(event) => {
        if (!onOpenInNewWindow) return;
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenInNewWindow(card.id);
      }}
      onPointerDown={
        onCardPointerDown
          ? (event) => {
              onCardPointerDown(card.id, event);
            }
          : undefined
      }
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onPointerCancel={onCardPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick(card.id, e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setMouseHovered(true)}
      onMouseLeave={() => setMouseHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <span ref={stackRef} className="arc-gallery-card-stack">
        <span
          className={`arc-gallery-card-media${videoHover.showVideo ? ' is-video-playing' : ''}${
            thumbFit === 'cover' ? ' arc-gallery-card-media--cover' : ''
          }`}
          style={
            thumbFit === 'cover' ? { aspectRatio: '4 / 3' } : { aspectRatio: galleryCardAspectRatio(card) }
          }
        >
          {thumbSrc ? (
            <GalleryThumb card={card} src={thumbSrc} mediaTab={mediaTab} fit={thumbFit} />
          ) : (
            <div
              className="arc-gallery-skeleton"
              style={
                thumbFit === 'cover'
                  ? { aspectRatio: '4 / 3', background: 'var(--gray-900)' }
                  : { aspectRatio: galleryCardAspectRatio(card), background: 'var(--gray-900)' }
              }
              aria-hidden
            />
          )}
          {videoHover.videoSrc ? (
            <video
              ref={videoHover.videoRef}
              className="arc-gallery-card-video"
              src={videoHover.videoSrc}
              muted
              playsInline
              preload="metadata"
              aria-hidden
              onTimeUpdate={videoHover.onTimeUpdate}
              onLoadedMetadata={videoHover.onLoadedMetadata}
            />
          ) : null}
          {!overlaySuppressed ? (
            <GalleryCardShade tintColor={card.dominantColorHex} active={overlayIntent} />
          ) : null}
        </span>

        {!overlaySuppressed ? (
          <span
            className={`arc-gallery-card-overlay${overlayActive ? ' is-active' : ''}`}
            aria-hidden={!overlayActive}
          >
            <span
              ref={overlayInnerRef}
              className="arc-gallery-card-overlay-inner arc-ui-kit-scope"
              data-btn-size={btnSize}
            >
              <span ref={overlayControlsRef} className="arc-gallery-card-overlay-controls">
                <span className="arc-gallery-card-overlay-controls__left">
                  <span
                    ref={overlayBadgeRef}
                    className={`btn btn-primary btn-ds arc-gallery-card-overlay-badge${formatLabel ? '' : ' arc-gallery-card-overlay-badge--icon-only'}`}
                  >
                    <span
                      className={`btn-ds__icon ${mediaTypeIconClass}`}
                      aria-hidden="true"
                    />
                    {formatLabel ? (
                      <span className="btn-ds__value text-s">{formatLabel}</span>
                    ) : null}
                  </span>
                  {isVideo && !hideOverlayTime ? (
                    <span
                      ref={overlayTimeRef}
                      className="btn btn-primary btn-ds arc-gallery-card-overlay-time"
                      aria-hidden="true"
                    >
                      <span className={`btn-ds__value ${videoTimeCodeClass}`}>
                        {formatVideoClock(videoHover.currentMs / 1000)}
                        <span className="arc-gallery-card-overlay-time__sep"> / </span>
                        {formatVideoClock(durationMs / 1000)}
                      </span>
                    </span>
                  ) : null}
                </span>
                <span ref={overlayRightRef} className="arc-gallery-card-overlay-controls__right">
                  {showMoodboardAction ? (
                    <Tooltip
                      content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                      position="top"
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        className="btn btn-primary btn-icon-only btn-ds arc-gallery-card-overlay-action"
                        aria-label={
                          inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'
                        }
                        onMouseEnter={() => setHoveredBookmarkCardId(true)}
                        onMouseLeave={() => setHoveredBookmarkCardId(false)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onToggleMoodboard?.(card.id);
                        }}
                      >
                        <span className={`btn-icon-only__glyph ${iconClass}`} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : null}
                  {showSimilarAction ? (
                    <Tooltip content="Найти похожее" position="top">
                      <button
                        type="button"
                        tabIndex={-1}
                        className="btn btn-primary btn-icon-only btn-ds arc-gallery-card-overlay-action"
                        aria-label="Найти похожее"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onFindSimilar?.(card.id);
                        }}
                      >
                        <span className="btn-icon-only__glyph arc-icon-search" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : null}
                </span>
              </span>

              {isVideo ? (
                <GalleryCardVideoTimeline
                  className="arc-gallery-card-overlay-timeline"
                  valueMs={videoHover.currentMs}
                  durationMs={durationMs}
                  onSeek={videoHover.seekToMs}
                  disabled={durationMs <= 0}
                />
              ) : null}
            </span>
          </span>
        ) : null}
      </span>
    </div>
    </div>
  );
}

function galleryCardTilePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.card.id === next.card.id &&
    prev.card.type === next.card.type &&
    prev.card.dominantColorHex === next.card.dominantColorHex &&
    prev.card.durationMs === next.card.durationMs &&
    prev.thumbSrc === next.thumbSrc &&
    prev.gridSize === next.gridSize &&
    prev.inMoodboard === next.inMoodboard &&
    prev.isSelected === next.isSelected &&
    prev.moodboardEnabled === next.moodboardEnabled &&
    prev.tileClassName === next.tileClassName &&
    prev.onCardClick === next.onCardClick &&
    prev.onOpenInNewWindow === next.onOpenInNewWindow &&
    prev.onCardPointerDown === next.onCardPointerDown &&
    prev.onCardPointerMove === next.onCardPointerMove &&
    prev.onCardPointerUp === next.onCardPointerUp &&
    prev.onFindSimilar === next.onFindSimilar &&
    prev.onToggleMoodboard === next.onToggleMoodboard &&
    prev.onContextMenu === next.onContextMenu &&
    prev.mediaTab === next.mediaTab &&
    prev.thumbFit === next.thumbFit
  );
}

export default memo(GalleryCardTile, galleryCardTilePropsEqual);
