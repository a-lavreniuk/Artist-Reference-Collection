import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import GalleryThumb from './GalleryThumb';
import { gallerySkeletonStyle } from './gallerySkeleton';
import { mergeCardsSrcMap, peekCardsSrcMap } from './galleryMediaCache';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize } from '../../layout/gridSizePreference';

type Props = {
  cards: CardRecord[];
  srcMap?: Record<string, string>;
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
  /** Без этого набора кнопка мудборда на карточке не показывается */
  moodboardCardIds?: Set<string>;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
};

export default function GalleryBoard({
  cards,
  srcMap: srcMapProp,
  onOpenCard,
  onFindSimilar,
  moodboardCardIds,
  onToggleMoodboard
}: Props) {
  const [localSrcMap, setLocalSrcMap] = useState<Record<string, string>>({});
  const [hoveredBookmarkCardId, setHoveredBookmarkCardId] = useState<string | null>(null);
  const [gridSizeVersion, setGridSizeVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const srcMap = srcMapProp ?? localSrcMap;

  useEffect(() => {
    const onGridSizeChanged = () => setGridSizeVersion((v) => v + 1);
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
    return () => window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
  }, []);

  useEffect(() => {
    if (srcMapProp) return;
    const gridSize = readGridSize();
    const peek = peekCardsSrcMap(cards, gridSize);
    setLocalSrcMap((prev) => ({ ...prev, ...peek }));
    let cancelled = false;
    void (async () => {
      const resolved = await mergeCardsSrcMap(cards, peek, gridSize);
      if (!cancelled) setLocalSrcMap((prev) => ({ ...prev, ...resolved }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, srcMapProp, gridSizeVersion]);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [cards, hoveredBookmarkCardId, moodboardCardIds]);

  const moodboardEnabled = Boolean(moodboardCardIds && onToggleMoodboard);

  return (
    <div ref={rootRef} className="arc-gallery-masonry">
      {cards.map((card) => {
        const inMoodboard = moodboardCardIds?.has(card.id) ?? false;
        const iconClass =
          hoveredBookmarkCardId === card.id
            ? inMoodboard
              ? 'arc-icon-bookmark-minus'
              : 'arc-icon-bookmark-plus'
            : 'arc-icon-bookmark';
        const mediaTypeIconClass = card.type === 'video' ? 'arc-icon-play' : 'arc-icon-image';
        const thumbSrc = srcMap[card.id];

        return (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            className={`arc-gallery-card-wrap panel elevation-default${inMoodboard ? ' is-in-moodboard' : ''}`}
            onClick={() => onOpenCard(card.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenCard(card.id);
              }
            }}
          >
            <span className="arc-gallery-card-stack">
              <span className="arc-gallery-card-badge" aria-hidden="true" data-btn-size="s">
                <span className={`tab-icon ${mediaTypeIconClass}`} />
              </span>
              {thumbSrc ? (
                <GalleryThumb card={card} src={thumbSrc} />
              ) : (
                <div className="arc-gallery-skeleton" style={gallerySkeletonStyle(card)} aria-hidden />
              )}
              <span className="arc-gallery-card-overlay">
                <span className="arc-gallery-card-overlay-inner" data-btn-size="s">
                  {onFindSimilar ? (
                    <button
                      type="button"
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
                    <Tooltip
                      content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                      position="top"
                    >
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds arc-gallery-overlay-bookmark arc-card-slot-blur-btn"
                        aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                        onMouseEnter={() => setHoveredBookmarkCardId(card.id)}
                        onMouseLeave={() =>
                          setHoveredBookmarkCardId((prev) => (prev === card.id ? null : prev))
                        }
                        onFocus={() => setHoveredBookmarkCardId(card.id)}
                        onBlur={() =>
                          setHoveredBookmarkCardId((prev) => (prev === card.id ? null : prev))
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onToggleMoodboard!(card.id);
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
      })}
    </div>
  );
}
