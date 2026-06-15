import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { CardRecord } from '../../services/db';
import { MasonryGrid, MASONRY_GAP_PX, resolveMasonryColumnCount } from '../masonry';
import { galleryMasonryItemHeight } from '../masonry/masonryItemHeight';
import { useContainerWidth } from '../masonry/useMasonryColumnCount';
import { readGridSize } from '../../layout/gridSizePreference';
import CardDetailSimilarThumb from './CardDetailSimilarThumb';
import { gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  cards: CardRecord[];
  srcMap: Record<string, string>;
  moodboardCardIds: Set<string>;
  inTrash: boolean;
  onOpenCard: (id: string) => void;
  onFindSimilar: (id: string) => void;
  onToggleMoodboard?: (id: string) => void | Promise<void>;
};

export default function SimilarCardsMasonry({
  cards,
  srcMap,
  moodboardCardIds,
  inTrash,
  onOpenCard,
  onFindSimilar,
  onToggleMoodboard
}: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const containerWidth = useContainerWidth(measureRef);
  const gridSize = readGridSize();
  const columnCount = resolveMasonryColumnCount(containerWidth, gridSize, 'similar');

  useEffect(() => {
    const scroll = measureRef.current?.closest('.arc-card-detail-scroll');
    if (scroll instanceof HTMLElement) {
      (scrollRootRef as RefObject<HTMLElement | null>).current = scroll;
    }
  }, [cards.length]);

  const masonryItems = useMemo(
    () =>
      cards.map((card) => ({
        id: card.id,
        height: galleryMasonryItemHeight(card, containerWidth, columnCount, MASONRY_GAP_PX)
      })),
    [cards, columnCount, containerWidth]
  );

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  return (
    <div ref={measureRef} className="arc-card-similar-masonry">
      <MasonryGrid
        items={masonryItems}
        variant="similar"
        scrollRootRef={scrollRootRef}
        gap={MASONRY_GAP_PX}
        virtualize={cards.length > 12}
        className="arc-card-similar-masonry-grid"
        renderItem={(id) => {
          const card = cardById.get(id);
          if (!card) return null;
          return (
            <CardDetailSimilarThumb
              card={card}
              src={srcMap[card.id]}
              onPick={() => onOpenCard(card.id)}
              onFindSimilar={onFindSimilar}
              inMoodboard={moodboardCardIds.has(card.id)}
              onToggleMoodboard={inTrash ? undefined : onToggleMoodboard}
            />
          );
        }}
        renderSkeleton={(_, layout) => {
          const card = cards[0];
          return (
            <div
              className="arc-gallery-skeleton arc-card-similar-skeleton"
              style={{ ...gallerySkeletonStyle(card), height: layout.height }}
              aria-hidden
            />
          );
        }}
      />
    </div>
  );
}
