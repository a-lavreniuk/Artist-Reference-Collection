import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import type { CardRecord } from '../../services/db';
import {
  addCollection,
  deleteCard,
  getCardById,
  permanentDeleteCard,
  restoreCard,
  updateCardPayload
} from '../../services/db';
import CardDetailCollectionsModal from './CardDetailCollectionsModal';
import ConfirmPermanentDeleteCardModal from './ConfirmPermanentDeleteCardModal';
import { buildCardContextMenuRows } from './buildCardContextMenuRows';
import type { CardContextMenuScope } from './cardContextMenuTypes';
import { openCardInNewWindowFromScope } from '../../card-viewer/openCardsInNewWindow';
import VideoPreviewFrameModal from './VideoPreviewFrameModal';
import { canPickVideoPreviewFrame } from './videoPreviewFrame';
import {
  formatCollectionAddToast,
  formatCollectionRemoveToast
} from './gallerySelectionCopy';
import {
  notifyGalleryMutation,
  notifyPermanentDelete,
  notifyRestoreWithUndo,
  notifyTrashWithUndo,
  undoCollectionAdd,
  undoCollectionRemove
} from './galleryUndoToast';
import { showAppNotification } from '../../services/notificationService';

type BulkHandlers = {
  onBulkSendToTrash?: (cardIds: string[]) => void | Promise<void>;
  onBulkRestore?: (cardIds: string[]) => void | Promise<void>;
  onBulkPermanentDelete?: (cardIds: string[]) => void | Promise<void>;
  onBulkToggleMoodboard?: (cardIds: string[]) => void | Promise<void>;
  onBulkOpenCollections?: (cardIds: string[]) => void;
  onBulkOpenTags?: (cardIds: string[]) => void;
  onBulkRemoveFromCollection?: (cardIds: string[], collectionId: string) => void | Promise<void>;
};

type Props = {
  scope: CardContextMenuScope;
  cards: CardRecord[];
  moodboardCardIds: Set<string>;
  onOpenCard: (id: string) => void;
  onToggleMoodboard: (id: string) => void | Promise<void>;
  onFindSimilar: (id: string) => void;
  onCardDeleted: () => void | Promise<void>;
  getSelectedCardIds?: () => readonly string[];
  isCardSelected?: (cardId: string) => boolean;
  selectionModeActive?: boolean;
  onToggleCardSelection?: (cardId: string) => void;
  onStartMultiSelect?: (cardId: string) => void;
  bulkHandlers?: BulkHandlers;
  onPreviewFrameSaved?: (card: CardRecord) => void;
  collectionName?: string;
};

export function useGalleryCardContextMenu({
  scope,
  cards,
  moodboardCardIds,
  onOpenCard,
  onToggleMoodboard,
  onFindSimilar,
  onCardDeleted,
  getSelectedCardIds = () => [],
  isCardSelected = () => false,
  selectionModeActive = false,
  onToggleCardSelection,
  onStartMultiSelect,
  bulkHandlers,
  onPreviewFrameSaved,
  collectionName
}: Props) {
  const menu = useContextMenuAtPointer();
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [previewFrameCard, setPreviewFrameCard] = useState<CardRecord | null>(null);
  const [collectionsCardId, setCollectionsCardId] = useState<string | null>(null);
  const [collectionsCard, setCollectionsCard] = useState<CardRecord | null>(null);
  const [permanentDeleteCardId, setPermanentDeleteCardId] = useState<string | null>(null);

  const menuCard = useMemo(
    () => (menuCardId ? cards.find((card) => card.id === menuCardId) ?? null : null),
    [cards, menuCardId]
  );
  const orderedCardIds = useMemo(() => cards.map((card) => card.id), [cards]);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuCardId(null);
  }, [menu]);

  const resolveTargetIds = useCallback(
    (cardId: string) => {
      const selected = getSelectedCardIds();
      if (selectionModeActive && selected.length > 0) {
        return [...selected];
      }
      if (selected.length > 0 && isCardSelected(cardId)) return [...selected];
      return [cardId];
    },
    [getSelectedCardIds, isCardSelected, selectionModeActive]
  );

  // Ссылка должна быть стабильной: обработчик уходит в каждую карточку ленты.
  const openMenuAt = menu.openAt;
  const openAtCard = useCallback(
    (card: CardRecord, event: React.MouseEvent) => {
      openMenuAt(event);
      setMenuCardId(card.id);
    },
    [openMenuAt]
  );

  const scopeCollectionId = scope.kind === 'collection' ? scope.collectionId : null;

  const openCollectionsPicker = useCallback(async (cardId: string) => {
    const targetIds = resolveTargetIds(cardId);
    if (targetIds.length > 1) {
      bulkHandlers?.onBulkOpenCollections?.(targetIds);
      return;
    }
    const card = await getCardById(cardId);
    if (!card) return;
    setCollectionsCard(card);
    setCollectionsCardId(cardId);
  }, [bulkHandlers, resolveTargetIds]);

  const menuRows = useMemo(() => {
    if (!menuCard) return [];
    const targetIds = resolveTargetIds(menuCard.id);
    const bulkCount = targetIds.length;
    const allInMoodboard = targetIds.every((id) => moodboardCardIds.has(id));
    const anyInMoodboard = targetIds.some((id) => moodboardCardIds.has(id));
    const inMoodboard = bulkCount > 1 ? allInMoodboard : moodboardCardIds.has(menuCard.id);
    const hasSourcePath = bulkCount > 1 ? targetIds.some((id) => {
      const card = cards.find((c) => c.id === id);
      return Boolean(card?.originalRelativePath?.trim());
    }) : Boolean(menuCard.originalRelativePath?.trim());

    return buildCardContextMenuRows({
      scope,
      inMoodboard,
      hasSourcePath,
      cardType: menuCard.type,
      cardFormat: menuCard.format,
      bulkSelectionCount: bulkCount,
      selectionModeActive,
      menuCardIsSelected: isCardSelected(menuCard.id),
      onStartMultiSelect:
        bulkCount <= 1 && onStartMultiSelect
          ? () => onStartMultiSelect(menuCard.id)
          : undefined,
      actions: {
        onOpen: () => onOpenCard(menuCard.id),
        onOpenInNewWindow: () => {
          void openCardInNewWindowFromScope({
            scope,
            feedOrder: orderedCardIds,
            cardId: menuCard.id,
            selectedIds: bulkCount > 1 ? targetIds : undefined,
            collectionName
          });
        },
        onPickPreviewFrame: canPickVideoPreviewFrame(menuCard)
          ? () => {
              closeMenu();
              void (async () => {
                const fresh = await getCardById(menuCard.id);
                if (fresh && canPickVideoPreviewFrame(fresh)) setPreviewFrameCard(fresh);
              })();
            }
          : undefined,
        onToggleCardSelection: () => onToggleCardSelection?.(menuCard.id),
        onToggleMoodboard: () => {
          if (bulkCount > 1) {
            void bulkHandlers?.onBulkToggleMoodboard?.(targetIds);
            return;
          }
          void onToggleMoodboard(menuCard.id);
        },
        onOpenCollections: () => void openCollectionsPicker(menuCard.id),
        onOpenTags:
          bulkCount > 1 && bulkHandlers?.onBulkOpenTags
            ? () => bulkHandlers.onBulkOpenTags?.(targetIds)
            : undefined,
        onFindSimilar: () => onFindSimilar(menuCard.id),
        onOpenSourceFolder: () => {
          if (!menuCard.originalRelativePath || !window.arc) return;
          void window.arc.showItemInFolder(menuCard.originalRelativePath);
        },
        onSendToTrash: async () => {
          if (bulkCount > 1) {
            await bulkHandlers?.onBulkSendToTrash?.(targetIds);
            return;
          }
          await deleteCard(menuCard.id);
          notifyTrashWithUndo(menuCard.id, onCardDeleted);
          await onCardDeleted();
        },
        onRestore: async () => {
          if (bulkCount > 1) {
            await bulkHandlers?.onBulkRestore?.(targetIds);
            return;
          }
          const result = await restoreCard(menuCard.id, {
            libraryId: menuCard.libraryId,
            sourceLibraryRoot: menuCard.libraryRoot
          });
          if (!result.ok) {
            showAppNotification({
              message:
                result.error === 'origin-missing'
                  ? 'Библиотека карточки недоступна. Откройте карточку, чтобы выбрать, куда восстановить.'
                  : result.error === 'files-unavailable'
                    ? 'Файлы карточки недоступны — восстановить нельзя'
                    : 'Не удалось восстановить карточку',
              variant: 'danger'
            });
            return;
          }
          notifyRestoreWithUndo(menuCard.id, onCardDeleted, menuCard.libraryId);
          await onCardDeleted();
        },
        onPermanentDelete: () => {
          if (bulkCount > 1) {
            void bulkHandlers?.onBulkPermanentDelete?.(targetIds);
            return;
          }
          if (scope.kind === 'trash') {
            void (async () => {
              await permanentDeleteCard(menuCard.id, undefined, menuCard.libraryId);
              notifyPermanentDelete(1);
              await onCardDeleted();
            })();
            return;
          }
          setPermanentDeleteCardId(menuCard.id);
        },
        onRemoveFromCollection: scopeCollectionId
          ? async () => {
              if (bulkCount > 1) {
                await bulkHandlers?.onBulkRemoveFromCollection?.(targetIds, scopeCollectionId);
                return;
              }
              const next = menuCard.collectionIds.filter((id) => id !== scopeCollectionId);
              await updateCardPayload(menuCard.id, { collectionIds: next });
              notifyGalleryMutation({
                message: formatCollectionRemoveToast(1),
                undo: undoCollectionRemove([menuCard.id], scopeCollectionId),
                onAfterUndo: onCardDeleted
              });
              await onCardDeleted();
            }
          : undefined,
        onRemoveFromMoodboard:
          scope.kind === 'moodboard-cards'
            ? () => {
                if (bulkCount > 1 && anyInMoodboard) {
                  void bulkHandlers?.onBulkToggleMoodboard?.(targetIds);
                  return;
                }
                void onToggleMoodboard(menuCard.id);
              }
            : undefined
      }
    });
  }, [
    bulkHandlers,
    cards,
    menuCard,
    moodboardCardIds,
    onCardDeleted,
    onFindSimilar,
    onOpenCard,
    orderedCardIds,
    onStartMultiSelect,
    onToggleCardSelection,
    onToggleMoodboard,
    openCollectionsPicker,
    resolveTargetIds,
    selectionModeActive,
    scope,
    scopeCollectionId,
    closeMenu,
    isCardSelected,
    collectionName
  ]);

  const openPreviewFramePicker = useCallback((card: CardRecord) => {
    if (!canPickVideoPreviewFrame(card)) return;
    void (async () => {
      const fresh = await getCardById(card.id);
      if (fresh && canPickVideoPreviewFrame(fresh)) setPreviewFrameCard(fresh);
    })();
  }, []);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuCard !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с карточкой"
        rows={menuRows}
      />

      {collectionsCardId && collectionsCard ? (
        <CardDetailCollectionsModal
          selectedCollectionIds={collectionsCard.collectionIds}
          onClose={() => {
            setCollectionsCardId(null);
            setCollectionsCard(null);
          }}
          onToggleCollection={async (collectionId) => {
            const card = await getCardById(collectionsCardId);
            if (!card) return;
            const has = card.collectionIds.includes(collectionId);
            const next = has
              ? card.collectionIds.filter((id) => id !== collectionId)
              : [...card.collectionIds, collectionId];
            await updateCardPayload(card.id, { collectionIds: next });
            notifyGalleryMutation({
              message: has ? formatCollectionRemoveToast(1) : formatCollectionAddToast(1),
              undo: has
                ? undoCollectionRemove([card.id], collectionId)
                : undoCollectionAdd([card.id], collectionId),
              onAfterUndo: onCardDeleted
            });
            const updated = await getCardById(collectionsCardId);
            if (updated) setCollectionsCard(updated);
            await onCardDeleted();
          }}
          onCreateAndAssign={async (name) => {
            const card = await getCardById(collectionsCardId);
            if (!card) return;
            const created = await addCollection(name);
            if (!card.collectionIds.includes(created.id)) {
              await updateCardPayload(card.id, {
                collectionIds: [...card.collectionIds, created.id]
              });
              notifyGalleryMutation({
                message: formatCollectionAddToast(1),
                undo: undoCollectionAdd([card.id], created.id),
                onAfterUndo: onCardDeleted
              });
            }
            const updated = await getCardById(collectionsCardId);
            if (updated) setCollectionsCard(updated);
            await onCardDeleted();
          }}
        />
      ) : null}

      {permanentDeleteCardId ? (
        <ConfirmPermanentDeleteCardModal
          onClose={() => setPermanentDeleteCardId(null)}
          onConfirm={async () => {
            await permanentDeleteCard(permanentDeleteCardId);
            notifyPermanentDelete(1);
            await onCardDeleted();
          }}
        />
      ) : null}

      {previewFrameCard ? (
        <VideoPreviewFrameModal
          card={previewFrameCard}
          onClose={() => setPreviewFrameCard(null)}
          onSaved={(updated) => {
            onPreviewFrameSaved?.(updated);
            void onCardDeleted();
          }}
        />
      ) : null}
    </>
  );

  return {
    onCardContextMenu: openAtCard,
    openPreviewFramePicker,
    contextMenuLayer
  };
}
