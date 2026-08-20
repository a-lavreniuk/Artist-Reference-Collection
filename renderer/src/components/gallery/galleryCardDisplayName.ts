import type { CardRecord } from '../../services/arcSchema';

/** Имя для List: внутренний путь файла в библиотеке. */
export function galleryCardDisplayName(card: CardRecord): string {
  const rel = card.originalRelativePath?.trim();
  if (rel) return rel;
  return card.id;
}
