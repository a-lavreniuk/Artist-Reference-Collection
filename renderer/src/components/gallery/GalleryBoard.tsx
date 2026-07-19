import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CardRecord } from '../../services/db';
import {
  MasonryGrid,
  resolveMasonryColumnCount,
  resolveMasonryGapPx,
  type MasonryVariant
} from '../masonry';
import { computeMasonryColumnWidth } from '../masonry/masonryColumnRules';
import { galleryMasonryItemHeight } from '../masonry/masonryItemHeight';
import { useContainerWidth } from '../masonry/useMasonryColumnCount';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize } from '../../layout/gridSizePreference';
import {
  ARC_GALLERY_LAYOUT_CHANGED_EVENT,
  readGalleryLayoutMode,
  type GalleryLayoutMode
} from '../../layout/galleryLayoutPreference';
import { useCardSectionMediaActive } from '../layout/cardSectionMedia';
import { mergeCardsSrcMap, peekCardsSrcMap } from './galleryMediaCache';
import { setGalleryThumbPixelBudget } from './galleryThumbBudget';
import GalleryCardTile from './GalleryCardTile';
import GalleryList from './GalleryList';
import GalleryListRow from './GalleryListRow';
import UniformGrid from './UniformGrid';
import { gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  cards: CardRecord[];
  srcMap?: Record<string, string>;
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
  moodboardCardIds?: Set<string>;
  onToggleMoodboard?: (cardId: string) => void | Promise<void>;
  onCardContextMenu?: (card: CardRecord, event: React.MouseEvent<HTMLDivElement>) => void;
  isCardSelected?: (cardId: string) => boolean;
  onCardClick?: (cardId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenInNewWindow?: (cardId: string) => void;
  onCardPointerDown?: (cardId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  boardRef?: RefObject<HTMLDivElement | null>;
  variant?: MasonryVariant;
  scrollRootRef?: RefObject<HTMLElement | null>;
  loadingMore?: boolean;
  busy?: boolean;
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
  /** Меняется при фильтрах / сортировке — перезапускает reveal карточек. */
  revealResetKey?: string;
  /** Принудительный режим (например similar — только masonry). */
  forceLayoutMode?: GalleryLayoutMode;
};

export default function GalleryBoard({
  cards,
  srcMap: srcMapProp,
  onOpenCard,
  onFindSimilar,
  moodboardCardIds,
  onToggleMoodboard,
  onCardContextMenu,
  isCardSelected,
  onCardClick,
  onOpenInNewWindow,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  boardRef: boardRefProp,
  variant = 'gallery',
  scrollRootRef,
  loadingMore = false,
  busy = false,
  mediaTab,
  revealResetKey = '',
  forceLayoutMode
}: Props) {
  const [tierSrcMap, setTierSrcMap] = useState<Record<string, string>>({});
  const [gridSizeVersion, setGridSizeVersion] = useState(0);
  const [layoutModeVersion, setLayoutModeVersion] = useState(0);
  const internalBoardRef = useRef<HTMLDivElement>(null);
  const boardRef = boardRefProp ?? internalBoardRef;
  const srcMap = useMemo(
    () => ({ ...(srcMapProp ?? {}), ...tierSrcMap }),
    [srcMapProp, tierSrcMap]
  );
  const containerWidth = useContainerWidth(boardRef);
  const gridSize = readGridSize();
  const layoutMode = forceLayoutMode ?? readGalleryLayoutMode();
  const tabMediaActive = useCardSectionMediaActive(mediaTab ?? 'gallery');
  const thumbsActive = mediaTab === undefined ? true : tabMediaActive;

  useEffect(() => {
    const onGridSizeChanged = () => setGridSizeVersion((v) => v + 1);
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
    return () => window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
  }, []);

  useEffect(() => {
    const onLayoutChanged = () => setLayoutModeVersion((v) => v + 1);
    window.addEventListener(ARC_GALLERY_LAYOUT_CHANGED_EVENT, onLayoutChanged);
    return () => window.removeEventListener(ARC_GALLERY_LAYOUT_CHANGED_EVENT, onLayoutChanged);
  }, []);

  // layoutModeVersion keeps prefer-read in sync with events when forceLayoutMode is unset
  void layoutModeVersion;

  const columnCount = resolveMasonryColumnCount(containerWidth, gridSize, variant);
  const masonryGap = resolveMasonryGapPx(gridSize);
  const columnWidth = computeMasonryColumnWidth(containerWidth, columnCount, masonryGap);
  const thumbBudget =
    layoutMode === 'list' ? Math.max(columnWidth, 64) : columnWidth;

  useEffect(() => {
    setGalleryThumbPixelBudget(thumbBudget);
    return () => setGalleryThumbPixelBudget(0);
  }, [thumbBudget]);

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
  }, [cards, srcMapProp, gridSizeVersion, thumbsActive, thumbBudget, mediaTab]);

  const masonryItems = useMemo(
    () =>
      cards.map((card) => ({
        id: card.id,
        height: galleryMasonryItemHeight(card, containerWidth, columnCount, masonryGap)
      })),
    [cards, columnCount, containerWidth, gridSize, gridSizeVersion, masonryGap]
  );

  const gridItems = useMemo(() => cards.map((card) => ({ id: card.id })), [cards]);
  const listItems = gridItems;

  const cardById = useMemo(() => {
    const map = new Map<string, CardRecord>();
    for (const card of cards) map.set(card.id, card);
    return map;
  }, [cards]);

  const moodboardEnabled = Boolean(moodboardCardIds && onToggleMoodboard);

  const handleCardClick = useCallback(
    (cardId: string, event: React.MouseEvent<HTMLDivElement>) => {
      if (onCardClick) {
        onCardClick(cardId, event);
        return;
      }
      onOpenCard(cardId);
    },
    [onCardClick, onOpenCard]
  );

  const renderTile = useCallback(
    (id: string, thumbFit: 'natural' | 'cover' = 'natural') => {
      const card = cardById.get(id);
      if (!card) return null;
      return (
        <GalleryCardTile
          card={card}
          thumbSrc={srcMap[card.id]}
          gridSize={gridSize}
          thumbFit={thumbFit}
          inMoodboard={moodboardCardIds?.has(card.id) ?? false}
          isSelected={isCardSelected?.(card.id) ?? false}
          onCardClick={handleCardClick}
          onOpenInNewWindow={onOpenInNewWindow}
          onCardPointerDown={onCardPointerDown}
          onCardPointerMove={onCardPointerMove}
          onCardPointerUp={onCardPointerUp}
          onFindSimilar={onFindSimilar}
          onToggleMoodboard={onToggleMoodboard}
          interfaceTourAnchor={cards[0]?.id === card.id ? 'gallery-first-card' : undefined}
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
    [
      cardById,
      cards,
      gridSize,
      handleCardClick,
      isCardSelected,
      mediaTab,
      moodboardCardIds,
      moodboardEnabled,
      onCardContextMenu,
      onOpenInNewWindow,
      onCardPointerDown,
      onCardPointerMove,
      onCardPointerUp,
      onFindSimilar,
      onToggleMoodboard,
      srcMap
    ]
  );

  const renderMasonryItem = useCallback((id: string) => renderTile(id, 'natural'), [renderTile]);
  const renderGridItem = useCallback((id: string) => renderTile(id, 'cover'), [renderTile]);

  const renderListItem = useCallback(
    (id: string) => {
      const card = cardById.get(id);
      if (!card) return null;
      return (
        <GalleryListRow
          card={card}
          thumbSrc={srcMap[card.id]}
          isSelected={isCardSelected?.(card.id) ?? false}
          inMoodboard={moodboardCardIds?.has(card.id) ?? false}
          moodboardEnabled={moodboardEnabled}
          onCardClick={handleCardClick}
          onOpenInNewWindow={onOpenInNewWindow}
          onCardPointerDown={onCardPointerDown}
          onCardPointerMove={onCardPointerMove}
          onCardPointerUp={onCardPointerUp}
          onFindSimilar={onFindSimilar}
          onToggleMoodboard={onToggleMoodboard}
          interfaceTourAnchor={cards[0]?.id === card.id ? 'gallery-first-card' : undefined}
          onContextMenu={
            onCardContextMenu
              ? (event) => {
                  onCardContextMenu(card, event);
                }
              : undefined
          }
          mediaTab={mediaTab}
        />
      );
    },
    [
      cardById,
      cards,
      handleCardClick,
      isCardSelected,
      mediaTab,
      moodboardCardIds,
      moodboardEnabled,
      onCardContextMenu,
      onFindSimilar,
      onOpenInNewWindow,
      onCardPointerDown,
      onCardPointerMove,
      onCardPointerUp,
      onToggleMoodboard,
      srcMap
    ]
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

  const boardClass =
    layoutMode === 'list'
      ? 'arc-gallery-board arc-gallery-board--list'
      : layoutMode === 'grid'
        ? 'arc-gallery-board arc-gallery-board--grid'
        : 'arc-gallery-board arc-gallery-masonry';

  return (
    <div ref={boardRef} className={boardClass} data-interface-tour-anchor="gallery-grid">
      {layoutMode === 'list' ? (
        <GalleryList
          items={listItems}
          scrollRootRef={scrollRootRef}
          loadingMore={loadingMore}
          busy={busy}
          className="arc-gallery-list-view"
          renderItem={renderListItem}
        />
      ) : null}
      {layoutMode === 'grid' ? (
        <UniformGrid
          items={gridItems}
          variant={variant}
          scrollRootRef={scrollRootRef}
          gap={masonryGap}
          layoutEpoch={gridSizeVersion}
          loadingMore={loadingMore}
          busy={busy}
          className="arc-gallery-uniform-grid"
          renderSkeleton={renderSkeleton}
          renderItem={renderGridItem}
        />
      ) : null}
      {layoutMode === 'masonry' ? (
        <MasonryGrid
          items={masonryItems}
          variant={variant}
          scrollRootRef={scrollRootRef}
          gap={masonryGap}
          layoutEpoch={gridSizeVersion}
          revealResetKey={revealResetKey}
          loadingMore={loadingMore}
          busy={busy}
          className="arc-gallery-masonry-grid"
          renderSkeleton={renderSkeleton}
          renderItem={renderMasonryItem}
        />
      ) : null}
    </div>
  );
}
