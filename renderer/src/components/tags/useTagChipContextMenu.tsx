import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmDeleteTagModal from '../layout/ConfirmDeleteTagModal';
import TagMoveCategoryModal from './TagMoveCategoryModal';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { categoriesForManualTagTarget } from '@arc-main-shared/autoCreatedTagsCategory';
import { buildTagChipContextMenuRows } from './buildTagChipContextMenuRows';

type Props = {
  categories: CategoryRecord[];
  allTags: TagRecord[];
  selectedTagIds: ReadonlySet<string>;
  onShowInGallery: (tagIds: string[]) => void;
  onEdit: (tag: TagRecord) => void;
  onDelete: (tagIds: string[]) => Promise<void>;
  onMoveTagsToCategory: (tagIds: string[], categoryId: string) => Promise<void>;
  onMergeTags?: (tagIds: string[]) => void;
  onCreateCategoryForTags?: (tagIds: string[]) => void;
  onStartMultiSelect?: (tagId: string) => void;
};

export function useTagChipContextMenu({
  categories,
  allTags,
  selectedTagIds,
  onShowInGallery,
  onEdit,
  onDelete,
  onMoveTagsToCategory,
  onMergeTags,
  onCreateCategoryForTags,
  onStartMultiSelect
}: Props) {
  const menu = useContextMenuAtPointer();
  const [menuTag, setMenuTag] = useState<TagRecord | null>(null);
  const [deleteTagIds, setDeleteTagIds] = useState<string[] | null>(null);
  const [moveTagIds, setMoveTagIds] = useState<string[] | null>(null);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuTag(null);
  }, [menu]);

  const resolveMenuTagIds = useCallback(
    (tag: TagRecord): string[] => {
      if (selectedTagIds.has(tag.id) && selectedTagIds.size > 1) {
        return [...selectedTagIds];
      }
      return [tag.id];
    },
    [selectedTagIds]
  );

  const openMoveToCategory = useCallback((tagIds: string[]) => {
    if (tagIds.length > 0) setMoveTagIds(tagIds);
  }, []);

  const openDeleteTags = useCallback((tagIds: string[]) => {
    if (tagIds.length > 0) setDeleteTagIds(tagIds);
  }, []);

  const closeMove = useCallback(() => setMoveTagIds(null), []);

  const menuRows = useMemo(() => {
    if (!menuTag) return [];
    const tag = menuTag;
    const tagIds = resolveMenuTagIds(tag);
    const bulk = tagIds.length > 1;
    return buildTagChipContextMenuRows({
      bulk,
      onStartMultiSelect:
        !bulk && onStartMultiSelect
          ? () => {
              onStartMultiSelect(tag.id);
              closeMenu();
            }
          : undefined,
      onShowInGallery: () => {
        onShowInGallery(tagIds);
        closeMenu();
      },
      onMoveToCategory: () => {
        openMoveToCategory(tagIds);
        closeMenu();
      },
      onMerge:
        bulk && onMergeTags
          ? () => {
              onMergeTags(tagIds);
              closeMenu();
            }
          : undefined,
      onEdit: bulk ? undefined : () => onEdit(tag),
      onDelete: () => openDeleteTags(tagIds)
    });
  }, [
    closeMenu,
    menuTag,
    onEdit,
    onMergeTags,
    onShowInGallery,
    onStartMultiSelect,
    openDeleteTags,
    openMoveToCategory,
    resolveMenuTagIds
  ]);

  const openAtTag = useCallback(
    (tag: TagRecord, event: React.MouseEvent) => {
      menu.openAt(event);
      setMenuTag(tag);
    },
    [menu]
  );

  const deleteTagNames = useMemo(
    () =>
      (deleteTagIds ?? []).map(
        (id) => allTags.find((t) => t.id === id)?.name ?? 'Без названия'
      ),
    [allTags, deleteTagIds]
  );

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuTag !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с меткой"
        rows={menuRows}
      />

      {deleteTagIds && deleteTagIds.length > 0 ? (
        <ConfirmDeleteTagModal
          tagNames={deleteTagNames}
          onClose={() => setDeleteTagIds(null)}
          onConfirm={async () => {
            await onDelete(deleteTagIds);
          }}
        />
      ) : null}

      {moveTagIds && moveTagIds.length > 0 ? (
        <TagMoveCategoryModal
          categories={categoriesForManualTagTarget(categories)}
          selectedCount={moveTagIds.length}
          onClose={closeMove}
          onCreateCategory={
            onCreateCategoryForTags
              ? () => {
                  onCreateCategoryForTags(moveTagIds);
                  closeMove();
                }
              : undefined
          }
          onSelectCategory={async (categoryId) => {
            await onMoveTagsToCategory(moveTagIds, categoryId);
            closeMove();
          }}
        />
      ) : null}
    </>
  );

  return {
    openTagContextMenu: openAtTag,
    openMoveToCategory,
    openDeleteTags,
    contextMenuLayer
  };
}
