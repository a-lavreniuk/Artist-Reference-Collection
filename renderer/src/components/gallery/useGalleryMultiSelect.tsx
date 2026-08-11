import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CardRecord } from '../../services/db';
import type { CardContextMenuScope } from './cardContextMenuTypes';
import GallerySelectionBar, { type GallerySelectionBarVariant } from './GallerySelectionBar';
import BulkCardCollectionsModal from './BulkCardCollectionsModal';
import BulkCardTagsModal from './BulkCardTagsModal';
import {
  bulkAddMissingToMoodboard,
  bulkAddTagToCards,
  bulkAddToCollection,
  bulkPermanentDelete,
  bulkRemoveFromCollection,
  bulkRemoveFromMoodboard,
  bulkRestore,
  bulkSendToTrash,
  bulkToggleCollectionForCards,
  bulkToggleTagForCards
} from './galleryBulkActions';
import {
  formatCollectionAddToast,
  formatCollectionRemoveToast,
  formatMoodboardAddToast,
  formatMoodboardRemoveToast,
  formatPermanentDeleteToast,
  formatRestoreToast,
  formatTagAddToast,
  formatTagRemoveToast,
  formatTrashToast
} from './gallerySelectionCopy';
import {
  notifyGalleryMutation,
  undoCollectionAdd,
  undoCollectionRemove,
  undoMoodboardAdd,
  undoMoodboardRemove,
  undoRestore,
  undoTagAdd,
  undoTagRemove,
  undoTrash
} from './galleryUndoToast';
import { matchesShortcut } from '../../shortcuts/matchShortcutEvent';
import { isEditableTarget } from '../../shortcuts/shortcutGuards';
import { openCardInNewWindowFromScope, resolveFocusedGalleryCardId } from '../../card-viewer/openCardsInNewWindow';
import { useGalleryCardSelection } from './useGalleryCardSelection';
import { useGalleryCardLongPress, useGalleryMarqueeSelection } from './useGalleryMarqueeSelection';

type Options = {
  cards: CardRecord[];
  resetKey: string;
  scrollRootRef: RefObject<HTMLElement | null>;
  boardRef: RefObject<HTMLElement | null>;
  moodboardCardIds: Set<string>;
  scope: CardContextMenuScope;
  enabled?: boolean;
  onOpenCard: (id: string) => void;
  onRefresh: () => void | Promise<void>;
  refreshMoodboard?: () => void | Promise<void>;
};

export function useGalleryMultiSelect({
  cards,
  resetKey,
  scrollRootRef,
  boardRef,
  moodboardCardIds,
  scope,
  enabled = true,
  onOpenCard,
  onRefresh,
  refreshMoodboard
}: Options) {
  const orderedCardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const selection = useGalleryCardSelection(orderedCardIds, resetKey, onOpenCard);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const selectedIdsRef = useRef(selection.selectedIds);
  selectedIdsRef.current = selection.selectedIds;
  const handleMarquee = useCallback(
    (ids: string[]) => {
      selection.addMarqueeIds(ids);
    },
    [selection]
  );

  const { marquee } = useGalleryMarqueeSelection({
    boardRef,
    scrollRootRef,
    selectionMode: selection.selectionMode,
    enabled,
    onMarqueeSelect: handleMarquee
  });

  const longPress = useGalleryCardLongPress(selection.enterSelectionWithCard, enabled);

  const barVariant: GallerySelectionBarVariant = useMemo(() => {
    if (scope.kind === 'trash') return 'trash';
    if (scope.kind === 'collection') return 'collection';
    if (scope.kind === 'moodboard-cards') return 'moodboard';
    return 'library';
  }, [scope.kind]);

  const selectedCardIds = useMemo(() => [...selection.selectedIds], [selection.selectedIds]);

  const cardsById = useMemo(() => {
    const map = new Map<string, CardRecord>();
    for (const card of cards) map.set(card.id, card);
    for (const id of selection.selectedIds) {
      if (!map.has(id)) {
        const fromFeed = cards.find((c) => c.id === id);
        if (fromFeed) map.set(id, fromFeed);
      }
    }
    return map;
  }, [cards, selection.selectedIds]);

  const clearAfterAction = useCallback(() => {
    selection.clearSelection();
  }, [selection]);

  const refreshAfter = useCallback(async () => {
    await onRefresh();
    if (refreshMoodboard) await refreshMoodboard();
  }, [onRefresh, refreshMoodboard]);

  const runBulk = useCallback(
    async (
      action: () => Promise<string[]>,
      toast: (count: number) => string,
      undoFactory?: (affectedIds: string[]) => () => Promise<void>
    ) => {
      const affectedIds = await action();
      await refreshAfter();
      if (affectedIds.length > 0) {
        notifyGalleryMutation({
          message: toast(affectedIds.length),
          undo: undoFactory?.(affectedIds),
          onAfterUndo: refreshAfter
        });
      }
      clearAfterAction();
    },
    [clearAfterAction, refreshAfter]
  );

  const onAddToMoodboard = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(
      () => bulkAddMissingToMoodboard(ids, moodboardCardIds),
      formatMoodboardAddToast,
      undoMoodboardAdd
    );
  }, [moodboardCardIds, runBulk]);

  const onRemoveFromMoodboard = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(
      () => bulkRemoveFromMoodboard(ids, moodboardCardIds),
      formatMoodboardRemoveToast,
      undoMoodboardRemove
    );
  }, [moodboardCardIds, runBulk]);

  const onTrashAction = useCallback(() => {
    if (scope.kind === 'trash') return;
    const ids = [...selectedIdsRef.current];
    void runBulk(() => bulkSendToTrash(ids), formatTrashToast, undoTrash);
  }, [runBulk, scope.kind]);

  const onRestore = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(() => bulkRestore(ids), formatRestoreToast, undoRestore);
  }, [runBulk]);

  const onPermanentDelete = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(() => bulkPermanentDelete(ids), formatPermanentDeleteToast);
  }, [runBulk]);

  const onCollectionAction = useCallback(() => {
    if (scope.kind === 'collection') {
      const ids = [...selectedIdsRef.current];
      const collectionId = scope.collectionId;
      void runBulk(
        () => bulkRemoveFromCollection(ids, collectionId),
        formatCollectionRemoveToast,
        (affected) => undoCollectionRemove(affected, collectionId)
      );
      return;
    }
    setCollectionsOpen(true);
  }, [runBulk, scope]);

  const onTagsAction = useCallback(() => {
    setTagsOpen(true);
  }, []);

  const bulkHandlers = useMemo(
    () => ({
      onBulkSendToTrash: async (cardIds: string[]) => {
        await runBulk(() => bulkSendToTrash(cardIds), formatTrashToast, undoTrash);
      },
      onBulkRestore: async (cardIds: string[]) => {
        await runBulk(() => bulkRestore(cardIds), formatRestoreToast, undoRestore);
      },
      onBulkPermanentDelete: async (cardIds: string[]) => {
        await runBulk(() => bulkPermanentDelete(cardIds), formatPermanentDeleteToast);
      },
      onBulkToggleMoodboard: async (cardIds: string[]) => {
        const allInMoodboard =
          cardIds.length > 0 && cardIds.every((id) => moodboardCardIds.has(id));
        if (scope.kind === 'moodboard-cards' || allInMoodboard) {
          await runBulk(
            () => bulkRemoveFromMoodboard(cardIds, moodboardCardIds),
            formatMoodboardRemoveToast,
            undoMoodboardRemove
          );
          return;
        }
        await runBulk(
          () => bulkAddMissingToMoodboard(cardIds, moodboardCardIds),
          formatMoodboardAddToast,
          undoMoodboardAdd
        );
      },
      onBulkOpenCollections: () => {
        setCollectionsOpen(true);
      },
      onBulkOpenTags: () => {
        setTagsOpen(true);
      },
      onBulkRemoveFromCollection: async (cardIds: string[], collectionId: string) => {
        await runBulk(
          () => bulkRemoveFromCollection(cardIds, collectionId),
          formatCollectionRemoveToast,
          (affected) => undoCollectionRemove(affected, collectionId)
        );
      }
    }),
    [moodboardCardIds, runBulk, scope.kind]
  );

  const handleCardPointerDown = useCallback(
    (cardId: string, event: React.PointerEvent) => {
      // При Shift/Ctrl не трогаем якорь: он нужен click-обработчику для диапазонного выбора.
      if (event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        selection.noteAnchor(cardId);
      }
      longPress.onPointerDown(cardId, event);
    },
    [longPress, selection]
  );

  const handleCardClick = useCallback(
    (cardId: string, event: React.MouseEvent) => {
      if (longPress.consumeSuppressedClick()) return;
      if (selection.handleCardClick(cardId, event)) return;
      selection.handleOpenCard(cardId);
    },
    [longPress, selection]
  );

  const openInNewWindowForCard = useCallback(
    (cardId: string) => {
      const selected = [...selectedIdsRef.current];
      void openCardInNewWindowFromScope({
        scope,
        feedOrder: orderedCardIds,
        cardId,
        selectedIds: selection.selectionMode && selected.length > 0 ? selected : undefined
      });
    },
    [orderedCardIds, scope, selection.selectionMode]
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (document.body.classList.contains('arc-card-detail-open')) return;

      if (matchesShortcut(event, 'gallery.openInNewWindow')) {
        event.preventDefault();
        const selected = [...selectedIdsRef.current];
        const focusedId = resolveFocusedGalleryCardId();
        const cardId = focusedId ?? selected[0];
        if (!cardId) return;
        void openCardInNewWindowFromScope({
          scope,
          feedOrder: orderedCardIds,
          cardId,
          selectedIds: selected.length > 0 ? selected : undefined
        });
        return;
      }

      if (selection.selectedCount === 0 && !selection.selectionMode) return;

      if (matchesShortcut(event, 'gallery.clearSelection')) {
        event.preventDefault();
        selection.clearSelection();
        return;
      }

      if (matchesShortcut(event, 'gallery.deleteSelection')) {
        event.preventDefault();
        if (scope.kind === 'trash') {
          void onPermanentDelete();
        } else {
          void onTrashAction();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    enabled,
    onPermanentDelete,
    onTrashAction,
    scope.kind,
    selection.clearSelection,
    selection.selectedCount,
    selection.selectionMode,
    orderedCardIds
  ]);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove('arc-gallery-selection-active');
      return undefined;
    }
    if (selection.selectedCount > 0) {
      document.body.classList.add('arc-gallery-selection-active');
    } else {
      document.body.classList.remove('arc-gallery-selection-active');
    }
    return () => {
      document.body.classList.remove('arc-gallery-selection-active');
    };
  }, [enabled, selection.selectedCount]);

  const isMoodboardScope = scope.kind === 'moodboard-cards';
  const selectionBar = enabled ? (
    <GallerySelectionBar
      selectedCount={selection.selectedCount}
      variant={barVariant}
      onAddToMoodboard={scope.kind === 'trash' || isMoodboardScope ? undefined : onAddToMoodboard}
      onRemoveFromMoodboard={isMoodboardScope ? onRemoveFromMoodboard : undefined}
      onCollectionAction={scope.kind === 'trash' ? undefined : onCollectionAction}
      onTagsAction={scope.kind === 'trash' ? undefined : onTagsAction}
      onTrashAction={scope.kind === 'trash' ? undefined : onTrashAction}
      onRestore={scope.kind === 'trash' ? onRestore : undefined}
      onPermanentDelete={scope.kind === 'trash' ? onPermanentDelete : undefined}
      onClear={selection.clearSelection}
    />
  ) : null;

  const collectionsModal =
    collectionsOpen && scope.kind !== 'trash' ? (
      <BulkCardCollectionsModal
        cardIds={selectedCardIds}
        cardsById={cardsById}
        onClose={() => setCollectionsOpen(false)}
        onApplied={async () => {
          await onRefresh();
          setCollectionsOpen(false);
          clearAfterAction();
        }}
        onToggleCollection={async (collectionId, nextSelected) => {
          const affected = await bulkToggleCollectionForCards(
            selectedCardIds,
            collectionId,
            nextSelected
          );
          if (affected.length > 0) {
            notifyGalleryMutation({
              message: nextSelected
                ? formatCollectionAddToast(affected.length)
                : formatCollectionRemoveToast(affected.length),
              undo: nextSelected
                ? undoCollectionAdd(affected, collectionId)
                : undoCollectionRemove(affected, collectionId),
              onAfterUndo: refreshAfter
            });
            await refreshAfter();
          }
          return affected.length;
        }}
        onCreateAndAssign={async (name) => {
          const { addCollection } = await import('../../services/db');
          const created = await addCollection(name);
          const affected = await bulkAddToCollection(selectedCardIds, created.id);
          if (affected.length > 0) {
            notifyGalleryMutation({
              message: formatCollectionAddToast(affected.length),
              undo: undoCollectionAdd(affected, created.id),
              onAfterUndo: refreshAfter
            });
            await refreshAfter();
          }
        }}
      />
    ) : null;

  const tagsModal =
    tagsOpen && scope.kind !== 'trash' ? (
      <BulkCardTagsModal
        cardIds={selectedCardIds}
        cardsById={cardsById}
        onClose={() => setTagsOpen(false)}
        onToggleTag={async (tagId, nextSelected) => {
          const affected = await bulkToggleTagForCards(selectedCardIds, tagId, nextSelected);
          if (affected.length === 0) return;
          notifyGalleryMutation({
            message: nextSelected
              ? formatTagAddToast(affected.length)
              : formatTagRemoveToast(affected.length),
            undo: nextSelected ? undoTagAdd(affected, tagId) : undoTagRemove(affected, tagId),
            onAfterUndo: refreshAfter
          });
          await refreshAfter();
        }}
        onCreateAndAssign={async (tagId) => {
          const affected = await bulkAddTagToCards(selectedCardIds, tagId);
          if (affected.length === 0) return;
          notifyGalleryMutation({
            message: formatTagAddToast(affected.length),
            undo: undoTagAdd(affected, tagId),
            onAfterUndo: refreshAfter
          });
          await refreshAfter();
        }}
      />
    ) : null;

  const marqueeOverlay =
    marquee && enabled ? (
      <div
        className="arc-gallery-marquee"
        style={{
          left: marquee.rect.left,
          top: marquee.rect.top,
          width: marquee.rect.right - marquee.rect.left,
          height: marquee.rect.bottom - marquee.rect.top
        }}
        aria-hidden
      />
    ) : null;

  return {
    selection,
    selectedCardIds,
    isSelected: selection.isSelected,
    handleCardClick,
    handleCardPointerDown,
    openInNewWindowForCard,
    onCardPointerMove: longPress.onPointerMove,
    onCardPointerUp: longPress.onPointerUp,
    enterSelectionWithCard: selection.enterSelectionWithCard,
    toggleCardSelection: selection.toggleCardSelection,
    selectionMode: selection.selectionMode,
    selectionBar,
    collectionsModal,
    tagsModal,
    marqueeOverlay,
    selectionActive: selection.selectionMode || selection.selectedCount > 0,
    bulkHandlers
  };
}
