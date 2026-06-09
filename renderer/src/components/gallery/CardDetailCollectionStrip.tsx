import { useEffect, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { peekCardsSrcMap, resolveCardsSrcMap } from './galleryMediaCache';

type Props = {
  collectionId: string;
  previews: CardRecord[];
};

const STACK_LAYERS = [
  { key: 'top', zIndex: 3, overlap: true },
  { key: 'mid', zIndex: 2, overlap: true, overlay: 'mid' as const },
  { key: 'back', zIndex: 1, overlap: false, overlay: 'back' as const }
] as const;

export default function CardDetailCollectionStrip({ collectionId, previews }: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const cards = previews.slice(0, 3);
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
  }, [previews, collectionId]);

  return (
    <div className="arc-card-detail-collection-stack-box" aria-hidden="true">
      <div className="arc-card-detail-collection-stack">
      {STACK_LAYERS.map((layer, index) => {
        const card = previews[index];
        const href = card ? srcMap[card.id] : undefined;
        const hasPhoto = Boolean(card && href);

        return (
          <div
            key={`${collectionId}-${layer.key}`}
            className={`arc-card-detail-collection-stack-layer arc-card-detail-collection-stack-layer--${layer.key}${layer.overlap ? ' arc-card-detail-collection-stack-layer--overlap' : ''}`}
            style={{ zIndex: layer.zIndex }}
          >
            {hasPhoto ? (
              <>
                <img
                  className="arc-card-detail-collection-stack-img"
                  src={href}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                {layer.overlay ? (
                  <span
                    className={`arc-card-detail-collection-stack-overlay arc-card-detail-collection-stack-overlay--${layer.overlay}`}
                    aria-hidden="true"
                  />
                ) : null}
              </>
            ) : card ? (
              <span
                className="arc-card-detail-collection-stack-fill"
                style={card.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
              />
            ) : (
              <span className="arc-card-detail-collection-stack-fill arc-card-detail-collection-stack-fill--empty" />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
