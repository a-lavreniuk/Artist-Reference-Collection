/** Атрибут карточки — общий для сетки, списка и masonry (см. GalleryCardTile, GalleryListRow). */
export const GALLERY_CARD_ATTRIBUTE = 'data-gallery-card-id';

export function focusGalleryCardById(root: HTMLElement | null, cardId: string): boolean {
  if (!root) return false;
  const selector = `[${GALLERY_CARD_ATTRIBUTE}="${CSS.escape(cardId)}"]`;
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.focus();
  return true;
}
