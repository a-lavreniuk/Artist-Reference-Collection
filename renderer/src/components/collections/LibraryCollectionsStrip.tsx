import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { MediaSectionTab } from '../gallery/galleryMediaCache';
import CollectionGalleryCard from './CollectionGalleryCard';
import { collectionHref } from './collectionHref';
import { useHorizontalScrollStrip } from './useHorizontalScrollStrip';

export type GalleryCollectionStripItem = {
  collection: CollectionRecord;
  count: number;
  previews: CardRecord[];
  sectionCount?: number;
};

type Props = {
  items: GalleryCollectionStripItem[];
  onCollectionContextMenu?: (collectionId: string, event: React.MouseEvent) => void;
  onOpenCollection?: (collection: CollectionRecord) => void;
  mediaTab?: MediaSectionTab;
  ariaLabel?: string;
};

export default function LibraryCollectionsStrip({
  items,
  onCollectionContextMenu,
  onOpenCollection,
  mediaTab = 'gallery',
  ariaLabel = 'Коллекции'
}: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    scrollRef,
    dragging,
    canScrollBack,
    canScrollForward,
    scrollByStep,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onWheel,
    shouldSuppressChildClick,
    updateEdges
  } = useHorizontalScrollStrip({ scrollStepPx: 421 });

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
    updateEdges();
  }, [items, canScrollBack, canScrollForward, updateEdges]);

  return (
    <section
      ref={rootRef}
      className="arc-gallery-collections-strip arc-ui-kit-scope"
      data-btn-size="m"
      data-elevation="default"
      data-typo-tone="white"
      aria-label={ariaLabel}
    >
      <div className="arc-gallery-collections-strip__viewport">
        <div
          ref={scrollRef}
          className={`arc-gallery-collections-strip__scroll${dragging ? ' is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onWheel={onWheel}
        >
          <div className="arc-gallery-collections-strip__track">
            {items.map((item) => (
              <CollectionGalleryCard
                key={item.collection.id}
                collection={item.collection}
                previews={item.previews}
                count={item.count}
                sectionCount={item.sectionCount}
                mediaTab={mediaTab}
                onOpen={() => {
                  if (shouldSuppressChildClick()) return;
                  if (onOpenCollection) {
                    onOpenCollection(item.collection);
                    return;
                  }
                  navigate(collectionHref(item.collection));
                }}
                onContextMenu={(event) => {
                  onCollectionContextMenu?.(item.collection.id, event);
                }}
              />
            ))}
          </div>
        </div>

        {canScrollBack ? (
          <>
            <div
              className="arc-gallery-collections-strip__fade arc-gallery-collections-strip__fade--start"
              aria-hidden="true"
            />
            <button
              type="button"
              className="btn btn-secondary btn-ds btn-icon-only arc-gallery-collections-strip__arrow arc-gallery-collections-strip__arrow--back"
              aria-label="Прокрутить коллекции назад"
              onClick={() => scrollByStep(-1)}
            >
              <span
                className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-left"
                aria-hidden="true"
              />
            </button>
          </>
        ) : null}

        {canScrollForward ? (
          <>
            <div
              className="arc-gallery-collections-strip__fade arc-gallery-collections-strip__fade--end"
              aria-hidden="true"
            />
            <button
              type="button"
              className="btn btn-secondary btn-ds btn-icon-only arc-gallery-collections-strip__arrow arc-gallery-collections-strip__arrow--forward"
              aria-label="Прокрутить коллекции вперёд"
              onClick={() => scrollByStep(1)}
            >
              <span
                className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-right"
                aria-hidden="true"
              />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
