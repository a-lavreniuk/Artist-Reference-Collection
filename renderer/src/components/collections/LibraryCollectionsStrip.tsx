import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { MediaSectionTab } from '../gallery/galleryMediaCache';
import CollectionGalleryCard from './CollectionGalleryCard';
import { collectionHref } from './collectionHref';
import {
  CARD_GAP_FALLBACK_PX,
  CARD_WIDTH_PX,
  collectionsStripMetrics,
  collectionsStripVisibleRange
} from './collectionsStripWindow';
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
    shouldSuppressChildClick,
    updateEdges
  } = useHorizontalScrollStrip({
    scrollStepPx: CARD_WIDTH_PX + CARD_GAP_FALLBACK_PX,
    wheelMode: 'prevent'
  });

  const { cardWidth, gap, stride, totalWidth } = useMemo(
    () => collectionsStripMetrics(items.length),
    [items.length]
  );
  const [range, setRange] = useState(() =>
    collectionsStripVisibleRange(0, 1200, items.length, stride)
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const next = collectionsStripVisibleRange(el.scrollLeft, el.clientWidth, items.length, stride);
      setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [items.length, scrollRef, stride]);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
    updateEdges();
  }, [items, range.start, range.end, canScrollBack, canScrollForward, updateEdges]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const leftSpacer = range.start * stride;
  const visibleCount = Math.max(0, range.end - range.start);
  const visibleWidth =
    visibleCount <= 0 ? 0 : visibleCount * cardWidth + Math.max(0, visibleCount - 1) * gap;
  const rightSpacer = Math.max(0, totalWidth - leftSpacer - visibleWidth);
  const slice = items.slice(range.start, range.end);

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
        >
          <div className="arc-gallery-collections-strip__track" style={{ width: totalWidth }}>
            {leftSpacer > 0 ? (
              <div className="arc-gallery-collections-strip__spacer" style={{ width: leftSpacer }} aria-hidden />
            ) : null}
            <div className="arc-gallery-collections-strip__track-items">
              {slice.map((item) => (
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
            {rightSpacer > 0 ? (
              <div className="arc-gallery-collections-strip__spacer" style={{ width: rightSpacer }} aria-hidden />
            ) : null}
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
