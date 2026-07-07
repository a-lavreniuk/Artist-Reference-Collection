import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmDeleteTagModal from '../layout/ConfirmDeleteTagModal';
import TagMoveCategoryModal from './TagMoveCategoryModal';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { buildTagChipContextMenuRows } from './buildTagChipContextMenuRows';

type Props = {
  categories: CategoryRecord[];
  selectedTagIds: ReadonlySet<string>;
  onShowInGallery: (tagId: string) => void;
  onEdit: (tag: TagRecord) => void;
  onDelete: (tagId: string) => Promise<void>;
  onMoveTagsToCategory: (tagIds: string[], categoryId: string) => Promise<void>;
};

export function useTagChipContextMenu({
  categories,
  selectedTagIds,
  onShowInGallery,
  onEdit,
  onDelete,
  onMoveTagsToCategory
}: Props) {
  const menu = useContextMenuAtPointer();
  const [menuTag, setMenuTag] = useState<TagRecord | null>(null);
  const [deleteTag, setDeleteTag] = useState<TagRecord | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTagIds, setMoveTagIds] = useState<string[]>([]);

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

  const openAtTag = useCallback(
    (tag: TagRecord, event: React.MouseEvent) => {
      menu.openAt(event);
      setMenuTag(tag);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuTag) return [];
    const tag = menuTag;
    const tagIds = resolveMenuTagIds(tag);
    const bulk = tagIds.length > 1;
    return buildTagChipContextMenuRows({
      bulk,
      onShowInGallery: bulk ? undefined : () => onShowInGallery(tag.id),
      onMoveToCategory: () => {
        setMoveTagIds(tagIds);
        setMoveModalOpen(true);
        closeMenu();
      },
      onEdit: bulk ? undefined : () => onEdit(tag),
      onDelete: bulk ? undefined : () => setDeleteTag(tag)
    });
  }, [closeMenu, menuTag, onEdit, onShowInGallery, resolveMenuTagIds]);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuTag !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с меткой"
        rows={menuRows}
      />

      {deleteTag ? (
        <ConfirmDeleteTagModal
          tagName={deleteTag.name}
          onClose={() => setDeleteTag(null)}
          onConfirm={async () => {
            await onDelete(deleteTag.id);
          }}
        />
      ) : null}

      {moveModalOpen ? (
        <TagMoveCategoryModal
          categories={categories}
          selectedCount={moveTagIds.length}
          onClose={() => {
            setMoveModalOpen(false);
            setMoveTagIds([]);
          }}
          onSelectCategory={async (categoryId) => {
            await onMoveTagsToCategory(moveTagIds, categoryId);
            setMoveModalOpen(false);
            setMoveTagIds([]);
          }}
        />
      ) : null}
    </>
  );

  return {
    openTagContextMenu: openAtTag,
    contextMenuLayer
  };
}
