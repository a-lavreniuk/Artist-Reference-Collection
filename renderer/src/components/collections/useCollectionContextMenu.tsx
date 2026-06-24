import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmCollectionDeleteModal from '../layout/ConfirmCollectionDeleteModal';
import { buildCollectionContextMenuRows } from './buildCollectionContextMenuRows';

type Props = {
  onOpen: (collectionId: string) => void;
  onEdit: (collectionId: string) => void;
  onDelete: (collectionId: string) => Promise<void>;
};

export function useCollectionContextMenu({ onOpen, onEdit, onDelete }: Props) {
  const menu = useContextMenuAtPointer();
  const [menuCollectionId, setMenuCollectionId] = useState<string | null>(null);
  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuCollectionId(null);
  }, [menu]);

  const openAtCollection = useCallback(
    (collectionId: string, event: React.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.arc-tags-sidebar-row-handle')) {
        return;
      }
      menu.openAt(event);
      setMenuCollectionId(collectionId);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuCollectionId) return [];
    const id = menuCollectionId;
    return buildCollectionContextMenuRows({
      onOpen: () => onOpen(id),
      onRename: () => onEdit(id),
      onDelete: () => setDeleteCollectionId(id)
    });
  }, [menuCollectionId, onEdit, onOpen]);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuCollectionId !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с коллекцией"
        rows={menuRows}
      />

      {deleteCollectionId ? (
        <ConfirmCollectionDeleteModal
          onClose={() => setDeleteCollectionId(null)}
          onConfirm={async () => {
            await onDelete(deleteCollectionId);
          }}
        />
      ) : null}
    </>
  );

  return {
    openCollectionContextMenu: openAtCollection,
    contextMenuLayer
  };
}
