export const ARC_NAVBAR_COLLECTION_TITLE_EVENT = 'arc:navbar-collection-title';
/** Открыть модалку переименования коллекции (кнопка в навбаре на детали коллекции). */
export const ARC_RENAME_COLLECTION_REQUEST = 'arc:rename-collection-request';
export const ARC_COLLECTIONS_ADD_REQUEST = 'arc:collections-add-request';
export const ARC_ADD_CARDS_SUBMIT_REQUEST = 'arc:add-cards-submit-request';
export const ARC_EDIT_CARD_SUBMIT_REQUEST = 'arc:edit-card-submit-request';
export const ARC_ADD_CARDS_QUEUE_STATE_EVENT = 'arc:add-cards-queue-state';

export type ArcAddCardsQueueStateDetail = {
  hasItems: boolean;
  count: number;
};

let lastAddCardsQueueState: ArcAddCardsQueueStateDetail = { hasItems: false, count: 0 };

/** Последнее состояние очереди (для навбара до первого события или после гонки mount). */
export function getLastAddCardsQueueState(): ArcAddCardsQueueStateDetail {
  return lastAddCardsQueueState;
}

export function publishAddCardsQueueState(detail: ArcAddCardsQueueStateDetail): void {
  lastAddCardsQueueState = detail;
  window.dispatchEvent(
    new CustomEvent<ArcAddCardsQueueStateDetail>(ARC_ADD_CARDS_QUEUE_STATE_EVENT, { detail })
  );
}
