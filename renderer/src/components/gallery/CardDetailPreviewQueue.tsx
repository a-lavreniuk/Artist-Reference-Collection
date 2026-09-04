import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { useHorizontalScrollStrip } from '../collections/useHorizontalScrollStrip';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { formatVideoClock } from './cardDetailVideoTime';
import { peekCardsSrcMap } from './galleryMediaCache';

type Props = {
  cards: readonly CardRecord[];
  activeCardId: string;
  srcMap: Record<string, string>;
  onSelectCard: (cardId: string) => void;
};

export default function CardDetailPreviewQueue({ cards, activeCardId, srcMap, onSelectCard }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    scrollRef,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    shouldSuppressChildClick
  } = useHorizontalScrollStrip();

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [cards, activeCardId]);

  useLayoutEffect(() => {
    const selected = scrollRef.current?.querySelector('[data-queue-selected="true"]');
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [activeCardId, cards, scrollRef]);

  return (
    <div
      ref={rootRef}
      className="arc-card-detail-queue arc-ui-kit-scope"
      data-typo-tone="white"
      aria-label="Очередь карточек"
    >
      <div
        ref={scrollRef}
        className={`arc-card-detail-queue__scroll${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
      >
        <div className="arc-card-detail-queue__track">
          {cards.map((card) => {
            const selected = card.id === activeCardId;
            const href = srcMap[card.id];
            const durationLabel =
              card.type === 'video' && card.durationMs
                ? formatVideoClock(card.durationMs / 1000)
                : null;
            return (
              <button
                key={card.id}
                type="button"
                className={`arc-card-detail-queue__item${selected ? ' is-selected' : ''}`}
                data-queue-selected={selected ? 'true' : undefined}
                aria-current={selected ? 'true' : undefined}
                aria-label={selected ? 'Текущая карточка' : 'Открыть карточку'}
                onClick={() => {
                  if (shouldSuppressChildClick()) return;
                  if (card.id !== activeCardId) onSelectCard(card.id);
                }}
              >
                {href ? (
                  <img
                    className="arc-card-detail-queue__thumb"
                    src={href}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span
                    className="arc-card-detail-queue__thumb arc-card-detail-queue__thumb--empty"
                    style={card.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
                  />
                )}
                {durationLabel ? (
                  <span className="text-code-s arc-card-detail-queue__time">{durationLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function peekQueueThumbSrcMap(cards: readonly CardRecord[]): Record<string, string> {
  return peekCardsSrcMap(cards, 's');
}
