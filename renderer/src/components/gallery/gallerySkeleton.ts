import type { CSSProperties } from 'react';
import type { CardRecord } from '../../services/db';

export function galleryCardAspectRatio(card: CardRecord): number {
  const w = card.width;
  const h = card.height;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return w / h;
  }
  return 4 / 3;
}

export function gallerySkeletonStyle(card: CardRecord): CSSProperties {
  const style: CSSProperties = {
    aspectRatio: galleryCardAspectRatio(card)
  };
  if (card.dominantColorHex) {
    style.backgroundColor = card.dominantColorHex;
  }
  return style;
}
