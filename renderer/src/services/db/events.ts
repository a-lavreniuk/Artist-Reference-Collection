export const ARC_CATEGORIES_CHANGED_EVENT = 'arc:categories-changed';
export const ARC_TAGS_CHANGED_EVENT = 'arc:tags-changed';
export const ARC_CARDS_CHANGED_EVENT = 'arc:cards-changed';
export const ARC_COLLECTIONS_CHANGED_EVENT = 'arc:collections-changed';
export const ARC_MOODBOARD_BOARD_CHANGED_EVENT = 'arc:moodboard-board-changed';

export function notifyCardsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_CARDS_CHANGED_EVENT));
}

export function notifyCollectionsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_COLLECTIONS_CHANGED_EVENT));
}

export function notifyMoodboardBoardChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_MOODBOARD_BOARD_CHANGED_EVENT));
}

export function notifyCategoriesChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC_CATEGORIES_CHANGED_EVENT));
}

export function notifyTagsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC_TAGS_CHANGED_EVENT));
}
