import { useEffect, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { peekCardsSrcMap, resolveCardsSrcMap } from './galleryMediaCache';

type Props = {
  collectionId: string;
  previews: CardRecord[];
};

export default function CardDetailCollectionStrip({ collectionId, previews }: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});
  const card = previews[0];

  useEffect(() => {
    if (!card) {
      setSrcMap({});
      return;
    }
    const cards = [card];
    const peek = peekCardsSrcMap(cards, 's');
    setSrcMap(peek);
    let cancelled = false;
    void resolveCardsSrcMap(cards, 's').then((next) => {
      if (!cancelled) setSrcMap((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [card, collectionId]);

  const href = card ? srcMap[card.id] : undefined;
  const hasPhoto = Boolean(card && href);

  return (
    <div className="arc-card-detail-collection-stack-box" aria-hidden="true">
      <div className="arc-card-detail-collection-stack">
        <div className="arc-card-detail-collection-stack-layer arc-card-detail-collection-stack-layer--single">
          {hasPhoto ? (
            <img
              className="arc-card-detail-collection-stack-img"
              src={href}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : card ? (
            <span
              className="arc-card-detail-collection-stack-fill"
              style={card.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
            />
          ) : (
            <span className="arc-card-detail-collection-stack-fill arc-card-detail-collection-stack-fill--empty" />
          )}
        </div>
      </div>
    </div>
  );
}
