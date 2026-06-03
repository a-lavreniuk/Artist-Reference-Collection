import { useEffect, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';

type Props = {
  previews: CardRecord[];
};

/** Превью коллекции по макету Figma (137:8180): сетка 2×2 с левой ячейкой на две строки */
export default function CollectionPreviewMosaic({ previews }: Props) {
  const [srcById, setSrcById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!window.arc || previews.length === 0) {
      setSrcById({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const c of previews) {
        const rel = c.thumbRelativePath || c.originalRelativePath;
        if (!rel || rel === 'legacy') continue;
        const href = await window.arc!.toFileUrl(rel);
        if (href) next[c.id] = href;
      }
      if (!cancelled) setSrcById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [previews]);

  const thumb = (index: number) => {
    const card = previews[index];
    const href = card ? srcById[card.id] : null;
    return href ? (
      <img className="arc-collection-mosaic-thumb" src={href} alt="" loading="lazy" decoding="async" />
    ) : (
      <div
        className="arc-gallery-skeleton arc-collection-mosaic-skeleton"
        style={card?.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
        aria-hidden
      />
    );
  };

  return (
    <div className="arc-collection-mosaic" aria-hidden="true">
      <div className="arc-collection-mosaic-cell arc-collection-mosaic-cell--main">{thumb(0)}</div>
      <div className="arc-collection-mosaic-cell arc-collection-mosaic-cell--tr">{thumb(1)}</div>
      <div className="arc-collection-mosaic-cell arc-collection-mosaic-cell--br">{thumb(2)}</div>
    </div>
  );
}
