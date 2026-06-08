import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { peekCardsSrcMap, resolveCardsSrcMap } from './galleryMediaCache';
import { gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  collectionId: string;
  previews: CardRecord[];
};

export default function CardDetailCollectionStrip({ collectionId, previews }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [previews, srcMap]);

  useEffect(() => {
    if (previews.length === 0) {
      setSrcMap({});
      return;
    }
    const peek = peekCardsSrcMap(previews, 's');
    setSrcMap(peek);
    let cancelled = false;
    void resolveCardsSrcMap(previews, 's').then((next) => {
      if (!cancelled) setSrcMap((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [previews, collectionId]);

  const slots = useMemo(() => previews.slice(0, 3), [previews]);

  if (slots.length === 0) return null;

  return (
    <div ref={hostRef} className="arc-card-detail-collection-strip" aria-hidden="true">
      {slots.map((card, index) => {
        const href = srcMap[card.id];
        return (
          <span key={`${collectionId}-${card.id}-${index}`} className="arc-card-detail-collection-strip-thumb">
            {href ? (
              <img className="arc-card-detail-collection-strip-img" src={href} alt="" loading="lazy" decoding="async" />
            ) : (
              <span
                className="arc-gallery-skeleton arc-card-detail-collection-strip-skeleton"
                style={gallerySkeletonStyle(card)}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
