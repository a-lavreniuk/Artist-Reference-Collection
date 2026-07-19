import type { CardRecord } from '../../services/arcSchema';

/** Имя для List/подписей: пользовательское name, иначе уникальный id карточки. */
export function galleryCardDisplayName(card: CardRecord): string {
  const named = card.name?.trim();
  if (named) return named;
  return card.id;
}
