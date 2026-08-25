import { useEffect, useState } from 'react';
import type { CardRecord, CollectionRecord } from '../../services/db';
import { formatCardCountLabel } from '../../utils/formatCardCountLabel';
import { formatSectionCountLabel, isCollectionSection } from '@arc-main-shared/collectionHierarchy';
import { useCardSectionMediaActive } from '../layout/cardSectionMedia';
import {
  peekCardsSrcMap,
  resolveCardsSrcMap,
  type MediaSectionTab
} from '../gallery/galleryMediaCache';

const PREVIEW_SLOTS = 4;

type Props = {
  collection: CollectionRecord;
  previews: CardRecord[];
  count: number;
  sectionCount?: number;
  onOpen: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Должен совпадать с активной вкладкой CardSectionsShell (`?sect=` на media-server). */
  mediaTab?: MediaSectionTab;
};

export default function CollectionGalleryCard({
  collection,
  previews,
  count,
  sectionCount = 0,
  onOpen,
  onContextMenu,
  mediaTab = 'gallery'
}: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const stripMediaActive = useCardSectionMediaActive(mediaTab);

  useEffect(() => {
    const cards = previews.slice(0, PREVIEW_SLOTS);
    if (cards.length === 0) {
      setSrcMap({});
      return;
    }
    const peek = peekCardsSrcMap(cards, 's', mediaTab);
    setSrcMap(peek);
    if (!stripMediaActive) return;
    let cancelled = false;
    void resolveCardsSrcMap(cards, 's', mediaTab).then((next) => {
      if (!cancelled) setSrcMap((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [previews, collection.id, stripMediaActive, mediaTab]);

  const kindLabel = isCollectionSection(collection) ? 'Раздел' : 'Коллекция';
  return (
    <button
      type="button"
      className="arc-gallery-collection-card"
      aria-label={`${kindLabel} «${collection.name}», ${formatCardCountLabel(count)}${sectionCount > 0 ? `, ${formatSectionCountLabel(sectionCount)}` : ''}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <span className="arc-gallery-collection-card__pics" aria-hidden="true">
        {Array.from({ length: PREVIEW_SLOTS }, (_, index) => {
          const card = previews[index];
          const href = card ? srcMap[card.id] : undefined;
          const hasPhoto = Boolean(stripMediaActive && card && href);
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
                  draggable={false}
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
          {sectionCount > 0 ? ` · ${formatSectionCountLabel(sectionCount)}` : ''}
        </span>
      </span>
    </button>
  );
}
