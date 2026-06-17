import { useEffect, useState } from 'react';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { formatCardCountLabel } from '../../utils/formatCardCountLabel';
import { peekCardsSrcMap, resolveCardsSrcMap } from '../gallery/galleryMediaCache';

const PREVIEW_SLOTS = 4;

type Props = {
  collection: CollectionRecord;
  previews: CardRecord[];
  count: number;
  onOpen: () => void;
};

export default function CollectionGalleryCard({ collection, previews, count, onOpen }: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const cards = previews.slice(0, PREVIEW_SLOTS);
    if (cards.length === 0) {
      setSrcMap({});
      return;
    }
    const peek = peekCardsSrcMap(cards, 's');
    setSrcMap(peek);
    let cancelled = false;
    void resolveCardsSrcMap(cards, 's').then((next) => {
      if (!cancelled) setSrcMap((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [previews, collection.id]);

  return (
    <button
      type="button"
      className="arc-gallery-collection-card"
      aria-label={`Коллекция «${collection.name}», ${formatCardCountLabel(count)}`}
      onClick={onOpen}
    >
      <span className="arc-gallery-collection-card__pics" aria-hidden="true">
        {Array.from({ length: PREVIEW_SLOTS }, (_, index) => {
          const card = previews[index];
          const href = card ? srcMap[card.id] : undefined;
          const hasPhoto = Boolean(card && href);
          const isLast = index === PREVIEW_SLOTS - 1;

          return (
            <span
              key={`${collection.id}-slot-${index}`}
              className={`arc-gallery-collection-card__pic${isLast ? ' arc-gallery-collection-card__pic--grow' : ''}${hasPhoto ? '' : ' arc-gallery-collection-card__pic--empty'}`}
              style={
                !hasPhoto && card?.dominantColorHex
                  ? { backgroundColor: card.dominantColorHex }
                  : undefined
              }
            >
              {hasPhoto ? (
                <img
                  className="arc-gallery-collection-card__img"
                  src={href}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </span>
          );
        })}
      </span>
      <span className="text-l arc-gallery-collection-card__label">
        <span className="arc-gallery-collection-card__title">{collection.name}</span>
        <span className="arc-gallery-collection-card__count" aria-hidden="true">
          {count}
        </span>
      </span>
    </button>
  );
}
