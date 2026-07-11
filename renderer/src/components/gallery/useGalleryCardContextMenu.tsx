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

type BulkHandlers = {
  onBulkSendToTrash?: (cardIds: string[]) => void | Promise<void>;
  onBulkRestore?: (cardIds: string[]) => void | Promise<void>;
  onBulkPermanentDelete?: (cardIds: string[]) => void | Promise<void>;
  onBulkToggleMoodboard?: (cardIds: string[]) => void | Promise<void>;
  onBulkOpenCollections?: (cardIds: string[]) => void;
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
  onPreviewFrameSaved
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

  const openAtCard = useCallback(
    (card: CardRecord, event: React.MouseEvent) => {
      menu.openAt(event);
      setMenuCardId(card.id);
    },
    [menu]
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
            selectedIds: bulkCount > 1 ? targetIds : undefined
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
          await onCardDeleted();
        },
        onRestore: async () => {
          if (bulkCount > 1) {
            await bulkHandlers?.onBulkRestore?.(targetIds);
            return;
          }
          await restoreCard(menuCard.id);
          await onCardDeleted();
        },
        onPermanentDelete: () => {
          if (bulkCount > 1) {
            void bulkHandlers?.onBulkPermanentDelete?.(targetIds);
            return;
          }
          if (scope.kind === 'trash') {
            void (async () => {
              await permanentDeleteCard(menuCard.id);
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
    isCardSelected
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
            const updated = await getCardById(collectionsCardId);
            if (updated) setCollectionsCard(updated);
          }}
          onCreateAndAssign={async (name) => {
            const card = await getCardById(collectionsCardId);
            if (!card) return;
            const created = await addCollection(name);
            if (!card.collectionIds.includes(created.id)) {
              await updateCardPayload(card.id, {
                collectionIds: [...card.collectionIds, created.id]
              });
            }
            const updated = await getCardById(collectionsCardId);
            if (updated) setCollectionsCard(updated);
          }}
        />
      ) : null}

      {permanentDeleteCardId ? (
        <ConfirmPermanentDeleteCardModal
          onClose={() => setPermanentDeleteCardId(null)}
          onConfirm={async () => {
            await permanentDeleteCard(permanentDeleteCardId);
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
