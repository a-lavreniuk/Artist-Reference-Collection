import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CardRecord } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';
import type { CardContextMenuScope } from './cardContextMenuTypes';
import GallerySelectionBar, { type GallerySelectionBarVariant } from './GallerySelectionBar';
import BulkCardCollectionsModal from './BulkCardCollectionsModal';
import {
  bulkAddMissingToMoodboard,
  bulkAddToCollection,
  bulkPermanentDelete,
  bulkRemoveFromCollection,
  bulkRestore,
  bulkSendToTrash,
  bulkToggleCollectionForCards
} from './galleryBulkActions';
import {
  formatCollectionRemoveToast,
  formatMoodboardAddToast,
  formatPermanentDeleteToast,
  formatRestoreToast,
  formatTrashToast
} from './gallerySelectionCopy';
import { isEditableTarget } from './galleryCardSelectionCore';
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

  const runBulk = useCallback(
    async (action: () => Promise<number>, toast: (count: number) => string) => {
      const ids = [...selectedIdsRef.current];
      if (ids.length === 0) return;
      const count = await action();
      await onRefresh();
      if (refreshMoodboard) await refreshMoodboard();
      if (count > 0) {
        showAppNotification({ message: toast(count), variant: 'success' });
      }
      clearAfterAction();
    },
    [clearAfterAction, onRefresh, refreshMoodboard]
  );

  const onAddToMoodboard = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(
      () => bulkAddMissingToMoodboard(ids, moodboardCardIds),
      formatMoodboardAddToast
    );
  }, [moodboardCardIds, runBulk]);

  const onTrashAction = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    if (scope.kind === 'trash') return;
    void runBulk(() => bulkSendToTrash(ids), formatTrashToast);
  }, [runBulk, scope.kind]);

  const onRestore = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(() => bulkRestore(ids), formatRestoreToast);
  }, [runBulk]);

  const onPermanentDelete = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    void runBulk(() => bulkPermanentDelete(ids), formatPermanentDeleteToast);
  }, [runBulk]);

  const onCollectionAction = useCallback(() => {
    if (scope.kind === 'collection') {
      const ids = [...selectedIdsRef.current];
      void runBulk(
        () => bulkRemoveFromCollection(ids, scope.collectionId),
        formatCollectionRemoveToast
      );
      return;
    }
    setCollectionsOpen(true);
  }, [runBulk, scope]);

  const bulkHandlers = useMemo(
    () => ({
      onBulkSendToTrash: async (cardIds: string[]) => {
        await runBulk(() => bulkSendToTrash(cardIds), formatTrashToast);
      },
      onBulkRestore: async (cardIds: string[]) => {
        await runBulk(() => bulkRestore(cardIds), formatRestoreToast);
      },
      onBulkPermanentDelete: async (cardIds: string[]) => {
        await runBulk(() => bulkPermanentDelete(cardIds), formatPermanentDeleteToast);
      },
      onBulkToggleMoodboard: async (cardIds: string[]) => {
        await runBulk(
          () => bulkAddMissingToMoodboard(cardIds, moodboardCardIds),
          formatMoodboardAddToast
        );
      },
      onBulkOpenCollections: () => {
        setCollectionsOpen(true);
      },
      onBulkRemoveFromCollection: async (cardIds: string[], collectionId: string) => {
        await runBulk(
          () => bulkRemoveFromCollection(cardIds, collectionId),
          formatCollectionRemoveToast
        );
      }
    }),
    [moodboardCardIds, runBulk]
  );

  const handleCardPointerDown = useCallback(
    (cardId: string, event: React.PointerEvent) => {
      if (event.button === 0) {
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

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (selection.selectedCount === 0 && !selection.selectionMode) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        selection.clearSelection();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
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
    selection.selectionMode
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

  const selectionBar = enabled ? (
    <GallerySelectionBar
      selectedCount={selection.selectedCount}
      variant={barVariant}
      onAddToMoodboard={scope.kind === 'trash' ? undefined : onAddToMoodboard}
      onCollectionAction={scope.kind === 'trash' ? undefined : onCollectionAction}
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
          const count = await bulkToggleCollectionForCards(selectedCardIds, collectionId, nextSelected);
          return count;
        }}
        onCreateAndAssign={async (name) => {
          const { addCollection } = await import('../../services/db');
          const created = await addCollection(name);
          await bulkAddToCollection(selectedCardIds, created.id);
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
    onCardPointerMove: longPress.onPointerMove,
    onCardPointerUp: longPress.onPointerUp,
    enterSelectionWithCard: selection.enterSelectionWithCard,
    toggleCardSelection: selection.toggleCardSelection,
    selectionMode: selection.selectionMode,
    selectionBar,
    collectionsModal,
    marqueeOverlay,
    selectionActive: selection.selectionMode || selection.selectedCount > 0,
    bulkHandlers
  };
}
