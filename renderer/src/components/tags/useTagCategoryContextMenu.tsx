import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmDeleteCategoryModal from '../layout/ConfirmDeleteCategoryModal';
import { buildTagCategoryContextMenuRows } from './buildTagCategoryContextMenuRows';

type CategoryRef = {
  id: string;
  name: string;
};

type Props = {
  resolveCategory: (categoryId: string) => CategoryRef | null;
  onOpen: (categoryId: string) => void;
  onEdit: (categoryId: string) => void;
  onDelete: (categoryId: string) => Promise<void>;
};

export function useTagCategoryContextMenu({ resolveCategory, onOpen, onEdit, onDelete }: Props) {
  const menu = useContextMenuAtPointer();
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const deleteCategory = deleteCategoryId ? resolveCategory(deleteCategoryId) : null;

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuCategoryId(null);
  }, [menu]);

  const openAtCategory = useCallback(
    (categoryId: string, event: React.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.arc-tags-sidebar-row-handle')) {
        return;
      }
      menu.openAt(event);
      setMenuCategoryId(categoryId);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuCategoryId) return [];
    const id = menuCategoryId;
    return buildTagCategoryContextMenuRows({
      onOpen: () => onOpen(id),
      onRename: () => onEdit(id),
      onDelete: () => setDeleteCategoryId(id)
    });
  }, [menuCategoryId, onEdit, onOpen]);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuCategoryId !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с категорией"
        rows={menuRows}
      />

      {deleteCategory ? (
        <ConfirmDeleteCategoryModal
          categoryName={deleteCategory.name}
          onClose={() => setDeleteCategoryId(null)}
          onConfirm={async () => {
            await onDelete(deleteCategory.id);
          }}
        />
      ) : null}
    </>
  );

  return {
    openCategoryContextMenu: openAtCategory,
    contextMenuLayer
  };
}
