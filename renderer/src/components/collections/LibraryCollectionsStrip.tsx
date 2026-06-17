import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CollectionGalleryCard from './CollectionGalleryCard';
import { useHorizontalScrollStrip } from './useHorizontalScrollStrip';

export type GalleryCollectionStripItem = {
  collection: CollectionRecord;
  count: number;
  previews: CardRecord[];
};

type Props = {
  items: GalleryCollectionStripItem[];
};

export default function LibraryCollectionsStrip({ items }: Props) {
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
      data-elevation="default"
      data-typo-tone="white"
      aria-label="Коллекции"
    >
      {canScrollBack ? (
        <button
          type="button"
          className="btn btn-ghost btn-ds arc-gallery-collections-strip__arrow arc-gallery-collections-strip__arrow--back"
          aria-label="Прокрутить коллекции назад"
          onClick={() => scrollByStep(-1)}
        >
          <span className="btn-ds__icon arc-icon-chevron arc-gallery-collections-strip__chevron--left" aria-hidden="true" />
        </button>
      ) : null}

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
              onOpen={() => {
                if (shouldSuppressChildClick()) return;
                navigate(`/collections/${item.collection.id}`);
              }}
            />
          ))}
        </div>
      </div>

      {canScrollForward ? (
        <button
          type="button"
          className="btn btn-ghost btn-ds arc-gallery-collections-strip__arrow arc-gallery-collections-strip__arrow--forward"
          aria-label="Прокрутить коллекции вперёд"
          onClick={() => scrollByStep(1)}
        >
          <span className="btn-ds__icon arc-icon-chevron arc-gallery-collections-strip__chevron--right" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
