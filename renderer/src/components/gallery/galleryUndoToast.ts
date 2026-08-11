import {
  addCardToMoodboard,
  removeCardFromMoodboard
} from '../../services/db';
import {
  showAppNotification,
  showUndoableNotification
} from '../../services/notificationService';
import {
  bulkAddTagToCards,
  bulkAddToCollection,
  bulkRemoveFromCollection,
  bulkRemoveFromMoodboard,
  bulkRemoveTagFromCards,
  bulkAddMissingToMoodboard,
  bulkRestore,
  bulkSendToTrash
} from './galleryBulkActions';
import {
  formatMoodboardAddToast,
  formatMoodboardRemoveToast,
  formatPermanentDeleteToast,
  formatRestoreToast,
  formatTrashToast
} from './gallerySelectionCopy';

export type GalleryUndoRefresh = () => void | Promise<void>;

/**
 * Success toast после мутации карточек.
 * Если передан `undo` — кнопка «Отменить» на 16 с; после undo повторный undo-toast не показывается.
 */
export function notifyGalleryMutation(options: {
  message: string;
  undo?: () => void | Promise<void>;
  onAfterUndo?: GalleryUndoRefresh;
}): void {
  if (!options.undo) {
    showAppNotification({ message: options.message, variant: 'success' });
    return;
  }

  const { undo, onAfterUndo } = options;
  showUndoableNotification({
    message: options.message,
    variant: 'success',
    undo: async () => {
      try {
        await undo();
        await onAfterUndo?.();
      } catch {
        showAppNotification({
          message: 'Не удалось отменить действие',
          variant: 'danger',
          skipPrefCheck: true
        });
      }
    }
  });
}

export function undoTrash(cardIds: readonly string[]): () => Promise<void> {
  return async () => {
    await bulkRestore(cardIds);
  };
}

export function undoRestore(cardIds: readonly string[]): () => Promise<void> {
  return async () => {
    await bulkSendToTrash(cardIds);
  };
}

export function undoMoodboardAdd(cardIds: readonly string[]): () => Promise<void> {
  return async () => {
    await bulkRemoveFromMoodboard(cardIds, new Set(cardIds));
  };
}

export function undoMoodboardRemove(cardIds: readonly string[]): () => Promise<void> {
  return async () => {
    await bulkAddMissingToMoodboard(cardIds, new Set());
  };
}

export function undoCollectionAdd(
  cardIds: readonly string[],
  collectionId: string
): () => Promise<void> {
  return async () => {
    await bulkRemoveFromCollection(cardIds, collectionId);
  };
}

export function undoCollectionRemove(
  cardIds: readonly string[],
  collectionId: string
): () => Promise<void> {
  return async () => {
    await bulkAddToCollection(cardIds, collectionId);
  };
}

export function undoTagAdd(
  cardIds: readonly string[],
  tagId: string
): () => Promise<void> {
  return async () => {
    await bulkRemoveTagFromCards(cardIds, tagId);
  };
}

export function undoTagRemove(
  cardIds: readonly string[],
  tagId: string
): () => Promise<void> {
  return async () => {
    await bulkAddTagToCards(cardIds, tagId);
  };
}

export async function applyMoodboardAddWithUndo(
  cardId: string,
  onAfter: GalleryUndoRefresh
): Promise<void> {
  await addCardToMoodboard(cardId);
  await onAfter();
  notifyGalleryMutation({
    message: formatMoodboardAddToast(1),
    undo: undoMoodboardAdd([cardId]),
    onAfterUndo: onAfter
  });
}

export async function applyMoodboardRemoveWithUndo(
  cardId: string,
  onAfter: GalleryUndoRefresh
): Promise<void> {
  await removeCardFromMoodboard(cardId);
  await onAfter();
  notifyGalleryMutation({
    message: formatMoodboardRemoveToast(1),
    undo: undoMoodboardRemove([cardId]),
    onAfterUndo: onAfter
  });
}

export function notifyTrashWithUndo(cardId: string, onAfterUndo?: GalleryUndoRefresh): void {
  notifyGalleryMutation({
    message: formatTrashToast(1),
    undo: undoTrash([cardId]),
    onAfterUndo
  });
}

export function notifyRestoreWithUndo(cardId: string, onAfterUndo?: GalleryUndoRefresh): void {
  notifyGalleryMutation({
    message: formatRestoreToast(1),
    undo: undoRestore([cardId]),
    onAfterUndo
  });
}

export function notifyPermanentDelete(cardIdCount = 1): void {
  showAppNotification({
    message: formatPermanentDeleteToast(cardIdCount),
    variant: 'success'
  });
}
