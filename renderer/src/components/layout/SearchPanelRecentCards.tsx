import { useEffect, useState } from 'react';
import { getCardById, type CardRecord } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import { gallerySkeletonStyle } from '../gallery/gallerySkeleton';
import { peekCardsSrcMap, resolveCardsSrcMap } from '../gallery/galleryMediaCache';

type SearchPanelRecentCardsProps = {
  cardIds: readonly string[];
  onSelect: (cardId: string) => void;
};

export default function SearchPanelRecentCards({ cardIds, onSelect }: SearchPanelRecentCardsProps) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows: CardRecord[] = [];
      for (const id of cardIds) {
        const card = await getCardById(id);
        if (card) rows.push(card);
      }
      if (cancelled) return;
      setCards(rows);
      const gridSize = readGridSize();
      const peeked = peekCardsSrcMap(rows, gridSize);
      setSrcMap(peeked);
      const resolved = await resolveCardsSrcMap(rows, gridSize);
      if (!cancelled) setSrcMap((prev) => ({ ...prev, ...resolved }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cardIds]);

  if (cards.length === 0) return null;

  return (
    <div className="arc-search-recent-cards" role="list">
      {cards.map((card) => {
        const src = srcMap[card.id];
        const skeleton = gallerySkeletonStyle(card);
        return (
          <button
            key={card.id}
            type="button"
            className="arc-search-recent-card"
            role="listitem"
            aria-label={`Открыть карточку ${card.id.slice(0, 8)}`}
            onClick={() => onSelect(card.id)}
          >
            {src ? (
              <img className="arc-search-recent-card__img" src={src} alt="" decoding="async" />
            ) : (
              <span className="arc-search-recent-card__ph" style={skeleton} aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
