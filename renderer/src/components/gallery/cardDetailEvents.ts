/** Закрыть открытую детальную карточку без шага «назад» (смена таба Navbar). */
export const ARC_CARD_DETAIL_CLOSE_EVENT = 'arc:card-detail-close';

export function requestCloseCardDetail(): void {
  window.dispatchEvent(new CustomEvent(ARC_CARD_DETAIL_CLOSE_EVENT));
}
