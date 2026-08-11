import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addIdToSet,
  isEditableTarget,
  rangeSelectIds,
  toggleIdInSet
} from '../gallery/galleryCardSelectionCore';

export type TagMultiSelectApi = {
  selectedTagIds: ReadonlySet<string>;
  selectedCount: number;
  /** Обычный клик по чипу выделяет метку, а не открывает её настройки. */
  selectionMode: boolean;
  toggleTagSelection: (tagId: string) => void;
  isSelected: (tagId: string) => boolean;
  clearSelection: () => void;
  enterSelectionWithTag: (tagId: string) => void;
  handleTagPointerDown: (tagId: string, event: React.PointerEvent) => boolean;
  resolveDragTagIds: (anchorTagId: string) => ReadonlySet<string>;
  noteAnchor: (tagId: string) => void;
};

export function useTagMultiSelect(
  orderedTagIds: readonly string[],
  resetKey: string,
  isDragActive: boolean
): TagMultiSelectApi {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const anchorIdRef = useRef<string | null>(null);
  const selectedTagIdsRef = useRef(selectedTagIds);
  selectedTagIdsRef.current = selectedTagIds;
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  useEffect(() => {
    setSelectedTagIds(new Set());
    setSelectionMode(false);
    anchorIdRef.current = null;
  }, [resetKey]);

  const clearSelection = useCallback(() => {
    setSelectedTagIds(new Set());
    setSelectionMode(false);
    anchorIdRef.current = null;
  }, []);

  const noteAnchor = useCallback((tagId: string) => {
    anchorIdRef.current = tagId;
  }, []);

  /** Вход в множественный выбор с одной меткой — пункт «Выбрать несколько». */
  const enterSelectionWithTag = useCallback((tagId: string) => {
    const next = addIdToSet(new Set<string>(), tagId);
    selectedTagIdsRef.current = next;
    setSelectedTagIds(next);
    setSelectionMode(true);
    anchorIdRef.current = tagId;
  }, []);

  const toggleTagSelection = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = toggleIdInSet(prev, tagId);
      selectedTagIdsRef.current = next;
      if (next.size === 0) {
        setSelectionMode(false);
        anchorIdRef.current = null;
      } else {
        setSelectionMode(true);
        anchorIdRef.current = tagId;
      }
      return next;
    });
  }, []);

  const handleTagPointerDown = useCallback(
    (tagId: string, event: React.PointerEvent): boolean => {
      if (event.button !== 0) return false;
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      // Обычный клик не перехватываем: иначе ломается перетаскивание чипов.
      if (!ctrl && !shift) return false;

      event.preventDefault();
      event.stopPropagation();

      if (ctrl) {
        toggleTagSelection(tagId);
        return true;
      }

      setSelectedTagIds((prev) => {
        const next = rangeSelectIds(orderedTagIds, anchorIdRef.current, tagId, prev);
        selectedTagIdsRef.current = next;
        if (next.size > 0) setSelectionMode(true);
        return next;
      });
      anchorIdRef.current = tagId;
      return true;
    },
    [orderedTagIds, toggleTagSelection]
  );

  const resolveDragTagIds = useCallback((anchorTagId: string): ReadonlySet<string> => {
    const selected = selectedTagIdsRef.current;
    if (selected.has(anchorTagId) && selected.size > 0) {
      return selected;
    }
    return addIdToSet(new Set<string>(), anchorTagId);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      // Escape поверх модалки закрывает её, а не сбрасывает выбор меток.
      if (document.querySelector('.arc-modal-host')) return;
      if (event.key === 'Escape' && selectedTagIdsRef.current.size > 0) {
        event.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (isDragActive) return;
      if (selectedTagIdsRef.current.size === 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.chip, .context-menu, .arc-modal-host, .arc-tags-selection-bar')) return;
      if (!target.closest('.arc-tags-page')) return;
      clearSelection();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [clearSelection, isDragActive]);

  return useMemo(
    () => ({
      selectedTagIds,
      selectedCount: selectedTagIds.size,
      selectionMode,
      isSelected: (tagId: string) => selectedTagIds.has(tagId),
      clearSelection,
      enterSelectionWithTag,
      toggleTagSelection,
      handleTagPointerDown,
      resolveDragTagIds,
      noteAnchor
    }),
    [
      clearSelection,
      enterSelectionWithTag,
      handleTagPointerDown,
      noteAnchor,
      resolveDragTagIds,
      selectedTagIds,
      selectionMode,
      toggleTagSelection
    ]
  );
}

export async function moveTagsToCategory(
  tagIds: readonly string[],
  targetCategoryId: string,
  moveTagToCategory: (tagId: string, targetCategoryId: string) => Promise<void>
): Promise<void> {
  const unique = [...new Set(tagIds)];
  for (const tagId of unique) {
    await moveTagToCategory(tagId, targetCategoryId);
  }
}
