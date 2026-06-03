import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';

type Props = {
  cards: CardRecord[];
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
  /** Без этого набора кнопка мудборда на карточке не показывается */
  moodboardCardIds?: Set<string>;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
};

export default function GalleryBoard({
  cards,
  onOpenCard,
  onFindSimilar,
  moodboardCardIds,
  onToggleMoodboard
}: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const [hoveredBookmarkCardId, setHoveredBookmarkCardId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.arc) {
      setSrcMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const c of cards) {
        const rel = c.thumbRelativePath || c.originalRelativePath;
        if (!rel || rel === 'legacy') continue;
        const href = await window.arc!.toFileUrl(rel);
        if (href) next[c.id] = href;
      }
      if (!cancelled) setSrcMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

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
            {srcMap[card.id] ? (
              <img className="arc-gallery-thumb" src={srcMap[card.id]} alt="" loading="lazy" decoding="async" />
            ) : (
              <div
                className="arc-gallery-skeleton"
                style={card.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
                aria-hidden
              />
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
                      onMouseLeave={() => setHoveredBookmarkCardId((prev) => (prev === card.id ? null : prev))}
                      onFocus={() => setHoveredBookmarkCardId(card.id)}
                      onBlur={() => setHoveredBookmarkCardId((prev) => (prev === card.id ? null : prev))}
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
