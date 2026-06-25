import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CardRecord } from '../../services/db';
import { MasonryGrid, MASONRY_GAP_PX, resolveMasonryColumnCount, type MasonryVariant } from '../masonry';
import { computeMasonryColumnWidth } from '../masonry/masonryColumnRules';
import { galleryMasonryItemHeight } from '../masonry/masonryItemHeight';
import { useContainerWidth } from '../masonry/useMasonryColumnCount';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize } from '../../layout/gridSizePreference';
import { useCardSectionMediaActive } from '../layout/cardSectionMedia';
import { mergeCardsSrcMap, peekCardsSrcMap } from './galleryMediaCache';
import { setGalleryThumbPixelBudget } from './galleryThumbBudget';
import GalleryCardTile from './GalleryCardTile';
import { gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  cards: CardRecord[];
  srcMap?: Record<string, string>;
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
  moodboardCardIds?: Set<string>;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  onCardContextMenu?: (card: CardRecord, event: React.MouseEvent<HTMLDivElement>) => void;
  variant?: MasonryVariant;
  scrollRootRef?: RefObject<HTMLElement | null>;
  loadingMore?: boolean;
  busy?: boolean;
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
};

export default function GalleryBoard({
  cards,
  srcMap: srcMapProp,
  onOpenCard,
  onFindSimilar,
  moodboardCardIds,
  onToggleMoodboard,
  onCardContextMenu,
  variant = 'gallery',
  scrollRootRef,
  loadingMore = false,
  busy = false,
  mediaTab
}: Props) {
  const [tierSrcMap, setTierSrcMap] = useState<Record<string, string>>({});
  const [gridSizeVersion, setGridSizeVersion] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const srcMap = useMemo(
    () => ({ ...(srcMapProp ?? {}), ...tierSrcMap }),
    [srcMapProp, tierSrcMap]
  );
  const containerWidth = useContainerWidth(measureRef);
  const gridSize = readGridSize();
  const tabMediaActive = useCardSectionMediaActive(mediaTab ?? 'gallery');
  const thumbsActive = mediaTab === undefined ? true : tabMediaActive;

  useEffect(() => {
    const onGridSizeChanged = () => setGridSizeVersion((v) => v + 1);
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
    return () => window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
  }, []);

  const columnCount = resolveMasonryColumnCount(containerWidth, gridSize, variant);
  const columnWidth = computeMasonryColumnWidth(containerWidth, columnCount, MASONRY_GAP_PX);

  useEffect(() => {
    setGalleryThumbPixelBudget(columnWidth);
    return () => setGalleryThumbPixelBudget(0);
  }, [columnWidth]);

  useEffect(() => {
    if (!thumbsActive) return;
    const size = readGridSize();
    const peek = peekCardsSrcMap(cards, size, mediaTab);
    setTierSrcMap((prev) => ({ ...prev, ...peek }));
    let cancelled = false;
    void (async () => {
      const base = { ...(srcMapProp ?? {}), ...peek };
      const resolved = await mergeCardsSrcMap(cards, base, size, mediaTab);
      if (!cancelled) setTierSrcMap((prev) => ({ ...prev, ...resolved }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, srcMapProp, gridSizeVersion, thumbsActive, columnWidth, mediaTab]);

  const masonryItems = useMemo(
    () =>
      cards.map((card) => ({
        id: card.id,
        height: galleryMasonryItemHeight(card, containerWidth, columnCount, MASONRY_GAP_PX)
      })),
    [cards, columnCount, containerWidth, gridSizeVersion]
  );

  const cardById = useMemo(() => {
    const map = new Map<string, CardRecord>();
    for (const card of cards) map.set(card.id, card);
    return map;
  }, [cards]);

  const moodboardEnabled = Boolean(moodboardCardIds && onToggleMoodboard);

  const renderItem = useCallback(
    (id: string) => {
      const card = cardById.get(id);
      if (!card) return null;
      return (
        <GalleryCardTile
          card={card}
          thumbSrc={srcMap[card.id]}
          inMoodboard={moodboardCardIds?.has(card.id) ?? false}
          onOpenCard={onOpenCard}
          onFindSimilar={onFindSimilar}
          onToggleMoodboard={onToggleMoodboard}
          onContextMenu={
            onCardContextMenu
              ? (event) => {
                  onCardContextMenu(card, event);
                }
              : undefined
          }
          moodboardEnabled={moodboardEnabled}
          mediaTab={mediaTab}
        />
      );
    },
    [cardById, mediaTab, moodboardCardIds, moodboardEnabled, onCardContextMenu, onFindSimilar, onOpenCard, onToggleMoodboard, srcMap]
  );

  const renderSkeleton = useCallback(
    (_: string, layout: { height: number }) => {
      const card = cards[cards.length - 1];
      const style = card ? gallerySkeletonStyle(card) : undefined;
      return (
        <div
          className="arc-gallery-skeleton"
          style={{ ...style, width: '100%', height: layout.height }}
          aria-hidden
        />
      );
    },
    [cards]
  );

  return (
    <div ref={measureRef} className="arc-gallery-masonry">
      <MasonryGrid
        items={masonryItems}
        variant={variant}
        scrollRootRef={scrollRootRef}
        gap={MASONRY_GAP_PX}
        layoutEpoch={gridSizeVersion}
        loadingMore={loadingMore}
        busy={busy}
        className="arc-gallery-masonry-grid"
        renderSkeleton={renderSkeleton}
        renderItem={renderItem}
      />
    </div>
  );
}
