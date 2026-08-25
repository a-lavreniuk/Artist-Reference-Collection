import { useCallback, useMemo, useState } from 'react';
import { isCollectionSection } from '@arc-main-shared/collectionHierarchy';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmCollectionDeleteModal from '../layout/ConfirmCollectionDeleteModal';
import { buildCollectionContextMenuRows } from './buildCollectionContextMenuRows';

type CollectionRef = {
  id: string;
  name: string;
  parentId?: string | null;
};

type Props = {
  resolveCollection: (collectionId: string) => CollectionRef | null;
  canMoveSection: (collectionId: string) => boolean;
  canMergeSection: (collectionId: string) => boolean;
  onOpen: (collectionId: string) => void;
  onEdit: (collectionId: string) => void;
  onDelete: (collectionId: string) => Promise<void>;
  onAddSection: (parentId: string) => void;
  onDuplicate: (collectionId: string) => void;
  onMove: (collectionId: string) => void;
  onMerge: (collectionId: string) => void;
};

export function useCollectionContextMenu({
  resolveCollection,
  canMoveSection,
  canMergeSection,
  onOpen,
  onEdit,
  onDelete,
  onAddSection,
  onDuplicate,
  onMove,
  onMerge
}: Props) {
  const menu = useContextMenuAtPointer();
  const [menuCollectionId, setMenuCollectionId] = useState<string | null>(null);
  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);

  const deleteCollection = deleteCollectionId ? resolveCollection(deleteCollectionId) : null;
  const deleteIsSection = deleteCollection ? isCollectionSection(deleteCollection) : false;

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuCollectionId(null);
  }, [menu]);

  const openAtCollection = useCallback(
    (collectionId: string, event: React.MouseEvent) => {
      menu.openAt(event);
      setMenuCollectionId(collectionId);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuCollectionId) return [];
    const id = menuCollectionId;
    const target = resolveCollection(id);
    if (!target) return [];
    const isSection = isCollectionSection(target);
    return buildCollectionContextMenuRows({
      variant: isSection ? 'section' : 'collection',
      onOpen: () => onOpen(id),
      onRename: () => onEdit(id),
      onDelete: () => setDeleteCollectionId(id),
      onAddSection: () => onAddSection(id),
      onDuplicate: () => onDuplicate(id),
      onMove: () => onMove(id),
      onMerge: () => onMerge(id),
      canMove: canMoveSection(id),
      canMerge: canMergeSection(id)
    });
  }, [
    canMergeSection,
    canMoveSection,
    menuCollectionId,
    onAddSection,
    onDuplicate,
    onEdit,
    onMerge,
    onMove,
    onOpen,
    resolveCollection
  ]);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuCollectionId !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с коллекцией"
        rows={menuRows}
      />

      {deleteCollection ? (
        <ConfirmCollectionDeleteModal
          collectionName={deleteCollection.name}
          isSection={deleteIsSection}
          onClose={() => setDeleteCollectionId(null)}
          onConfirm={async () => {
            await onDelete(deleteCollection.id);
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
