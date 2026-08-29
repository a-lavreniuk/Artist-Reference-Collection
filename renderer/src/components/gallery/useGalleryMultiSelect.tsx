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
  bulkToggleTagForCards,
  libraryMapsFromCards
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
import { isContextMenuOpen, isEditableTarget } from '../../shortcuts/shortcutGuards';
import { openCardInNewWindowFromScope, resolveFocusedGalleryCardId } from '../../card-viewer/openCardsInNewWindow';
import { useGalleryCardSelection } from './useGalleryCardSelection';
import { useGalleryCardLongPress, useGalleryMarqueeSelection } from './useGalleryMarqueeSelection';
import GalleryMarqueeOverlay from './GalleryMarqueeOverlay';
import { SELECT_ALL_IDS_CAP } from './gallerySelectAllIds';
import { showAppNotification } from '../../services/notificationService';

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
  /**
   * Полный список id раздела для Ctrl+A. Без него «выделить всё» берёт
   * только уже загруженные карточки ленты.
   */
  resolveSelectAllIds?: () => Promise<string[]>;
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
  refreshMoodboard,
  resolveSelectAllIds
}: Options) {
  const orderedCardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const selection = useGalleryCardSelection(orderedCardIds, resetKey, onOpenCard);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const selectedIdsRef = useRef(selection.selectedIds);
  selectedIdsRef.current = selection.selectedIds;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const orderedCardIdsRef = useRef(orderedCardIds);
  orderedCardIdsRef.current = orderedCardIds;
  const resolveSelectAllIdsRef = useRef(resolveSelectAllIds);
  resolveSelectAllIdsRef.current = resolveSelectAllIds;
  const selectAllSeqRef = useRef(0);

  const getSelectedIdsForMarquee = useCallback(() => selectedIdsRef.current, []);
  const handleMarqueeSelection = useCallback(
    (ids: Set<string>) => {
      selection.applyMarqueeSelection(ids);
    },
    [selection]
  );
  const handleEmptyClick = useCallback(() => {
    selection.clearSelection();
  }, [selection]);

  const { subscribeMarquee } = useGalleryMarqueeSelection({
    boardRef,
    scrollRootRef,
    enabled,
    getSelectedIds: getSelectedIdsForMarquee,
    onSelectionChange: handleMarqueeSelection,
    onEmptyClick: handleEmptyClick
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
    const maps = libraryMapsFromCards(cardsById, ids);
    void runBulk(() => bulkSendToTrash(ids, maps.libraryIdByCard), formatTrashToast, (affected) =>
      undoTrash(affected, libraryMapsFromCards(cardsById, affected).libraryIdByCard)
    );
  }, [runBulk, scope.kind, cardsById]);

  const onRestore = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    const maps = libraryMapsFromCards(cardsById, ids);
    void runBulk(
      () => bulkRestore(ids, maps),
      formatRestoreToast,
      (affected) => undoRestore(affected, libraryMapsFromCards(cardsById, affected).libraryIdByCard)
    );
  }, [runBulk, cardsById]);

  const onPermanentDelete = useCallback(() => {
    const ids = [...selectedIdsRef.current];
    const maps = libraryMapsFromCards(cardsById, ids);
    void runBulk(
      () => bulkPermanentDelete(ids, maps.libraryIdByCard),
      formatPermanentDeleteToast
    );
  }, [runBulk, cardsById]);

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
        const maps = libraryMapsFromCards(cardsById, cardIds);
        await runBulk(
          () => bulkSendToTrash(cardIds, maps.libraryIdByCard),
          formatTrashToast,
          (affected) => undoTrash(affected, libraryMapsFromCards(cardsById, affected).libraryIdByCard)
        );
      },
      onBulkRestore: async (cardIds: string[]) => {
        const maps = libraryMapsFromCards(cardsById, cardIds);
        await runBulk(
          () => bulkRestore(cardIds, maps),
          formatRestoreToast,
          (affected) => undoRestore(affected, libraryMapsFromCards(cardsById, affected).libraryIdByCard)
        );
      },
      onBulkPermanentDelete: async (cardIds: string[]) => {
        const maps = libraryMapsFromCards(cardsById, cardIds);
        await runBulk(
          () => bulkPermanentDelete(cardIds, maps.libraryIdByCard),
          formatPermanentDeleteToast
        );
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
    [moodboardCardIds, runBulk, scope.kind, cardsById]
  );

  // Колбэки карточек держим со стабильной ссылкой: иначе memo плиток не работает
  // и при каждом изменении выделения перерисовывается вся видимая лента.
  const { onPointerDown: longPressPointerDown, consumeSuppressedClick } = longPress;

  const handleCardPointerDown = useCallback(
    (cardId: string, event: React.PointerEvent) => {
      // При Shift/Ctrl не трогаем якорь: он нужен click-обработчику для диапазонного выбора.
      if (event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        selectionRef.current.noteAnchor(cardId);
      }
      longPressPointerDown(cardId, event);
    },
    [longPressPointerDown]
  );

  const handleCardClick = useCallback(
    (cardId: string, event: React.MouseEvent) => {
      if (consumeSuppressedClick()) return;
      if (selectionRef.current.handleCardClick(cardId, event)) return;
      selectionRef.current.handleOpenCard(cardId);
    },
    [consumeSuppressedClick]
  );

  /**
   * Выделяет загруженные карточки сразу, затем — весь раздел, если страница
   * умеет отдать полный список id (коллекции, мудборд).
   */
  const selectAllCards = useCallback(() => {
    const seq = ++selectAllSeqRef.current;
    selection.selectAllIds(orderedCardIdsRef.current);
    const resolver = resolveSelectAllIdsRef.current;
    if (!resolver) return;
    void (async () => {
      try {
        const ids = await resolver();
        if (seq !== selectAllSeqRef.current) return;
        if (ids.length > 0) selection.selectAllIds(ids);
        if (ids.length >= SELECT_ALL_IDS_CAP) {
          showAppNotification({
            message: `Выделено первые ${SELECT_ALL_IDS_CAP.toLocaleString('ru-RU')} карточек`,
            variant: 'warning'
          });
        }
      } catch {
        // Дозапрос не удался — остаётся выделение по загруженным карточкам.
      }
    })();
  }, [selection]);

  useEffect(() => {
    selectAllSeqRef.current += 1;
  }, [resetKey]);

  const openInNewWindowForCard = useCallback(
    (cardId: string) => {
      const selected = [...selectedIdsRef.current];
      void openCardInNewWindowFromScope({
        scope: scopeRef.current,
        feedOrder: orderedCardIdsRef.current,
        cardId,
        selectedIds:
          selectionRef.current.selectionMode && selected.length > 0 ? selected : undefined
      });
    },
    []
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

      if (matchesShortcut(event, 'gallery.selectAll')) {
        // Поверх модалки и меню Ctrl+A относится к их содержимому, не к ленте.
        if (document.querySelector('.arc-modal-host') || isContextMenuOpen()) return;
        event.preventDefault();
        selectAllCards();
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
    selectAllCards,
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

  const marqueeOverlay = enabled ? <GalleryMarqueeOverlay subscribe={subscribeMarquee} /> : null;

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
