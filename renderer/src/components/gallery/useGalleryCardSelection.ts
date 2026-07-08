import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addIdToSet,
  addIdsToSet,
  rangeSelectIds,
  toggleIdInSet
} from './galleryCardSelectionCore';

type Options = {
  orderedCardIds: readonly string[];
  /** Сброс при смене фильтров / поиска / scope. */
  resetKey: string;
};

export type GalleryCardSelectionApi = {
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  selectedCount: number;
  isSelected: (cardId: string) => boolean;
  clearSelection: () => void;
  enterSelectionWithCard: (cardId: string) => void;
  toggleCardSelection: (cardId: string) => void;
  addMarqueeIds: (ids: string[]) => void;
  noteAnchor: (cardId: string) => void;
  handleCardClick: (cardId: string, event: React.MouseEvent) => boolean;
  handleOpenCard: (cardId: string) => void;
};

export function useGalleryCardSelection(
  orderedCardIds: readonly string[],
  resetKey: string,
  onOpenCard: (cardId: string) => void
): GalleryCardSelectionApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const anchorIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    anchorIdRef.current = null;
  }, [resetKey]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    anchorIdRef.current = null;
  }, []);

  const activateSelection = useCallback((nextIds: Set<string>, anchorId: string) => {
    setSelectionMode(true);
    setSelectedIds(nextIds);
    anchorIdRef.current = anchorId;
  }, []);

  const enterSelectionWithCard = useCallback(
    (cardId: string) => {
      activateSelection(addIdToSet(new Set(), cardId), cardId);
    },
    [activateSelection]
  );

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedIds((prev) => {
      const next = toggleIdInSet(prev, cardId);
      if (next.size === 0) {
        setSelectionMode(false);
        anchorIdRef.current = null;
      } else {
        setSelectionMode(true);
        anchorIdRef.current = cardId;
      }
      return next;
    });
  }, []);

  const addMarqueeIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setSelectionMode(true);
      setSelectedIds((prev) => addIdsToSet(prev, ids));
      if (!anchorIdRef.current) anchorIdRef.current = ids[0] ?? null;
    },
    []
  );

  const noteAnchor = useCallback((cardId: string) => {
    anchorIdRef.current = cardId;
  }, []);

  const handleCardClick = useCallback(
    (cardId: string, event: React.MouseEvent): boolean => {
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;

      if (ctrl) {
        setSelectionMode(true);
        setSelectedIds((prev) => toggleIdInSet(prev, cardId));
        anchorIdRef.current = cardId;
        return true;
      }

      if (shift) {
        setSelectionMode(true);
        setSelectedIds((prev) => rangeSelectIds(orderedCardIds, anchorIdRef.current, cardId, prev));
        anchorIdRef.current = cardId;
        return true;
      }

      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = toggleIdInSet(prev, cardId);
          if (next.size === 0) {
            setSelectionMode(false);
            anchorIdRef.current = null;
          } else {
            anchorIdRef.current = cardId;
          }
          return next;
        });
        return true;
      }

      anchorIdRef.current = cardId;
      return false;
    },
    [orderedCardIds, selectionMode]
  );

  const handleOpenCard = useCallback(
    (cardId: string) => {
      if (selectionMode) return;
      onOpenCard(cardId);
    },
    [onOpenCard, selectionMode]
  );

  const selectedCount = selectedIds.size;

  return useMemo(
    () => ({
      selectionMode,
      selectedIds,
      selectedCount,
      isSelected: (cardId: string) => selectedIds.has(cardId),
      clearSelection,
      enterSelectionWithCard,
      toggleCardSelection,
      addMarqueeIds,
      noteAnchor,
      handleCardClick,
      handleOpenCard
    }),
    [
      addMarqueeIds,
      noteAnchor,
      clearSelection,
      enterSelectionWithCard,
      toggleCardSelection,
      handleCardClick,
      handleOpenCard,
      selectedCount,
      selectedIds,
      selectionMode
    ]
  );
}
