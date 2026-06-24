import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import ConfirmDeleteTagModal from '../layout/ConfirmDeleteTagModal';
import type { TagRecord } from '../../services/db';
import { buildTagChipContextMenuRows } from './buildTagChipContextMenuRows';

type Props = {
  onShowInGallery: (tagId: string) => void;
  onEdit: (tag: TagRecord) => void;
  onDelete: (tagId: string) => Promise<void>;
};

export function useTagChipContextMenu({ onShowInGallery, onEdit, onDelete }: Props) {
  const menu = useContextMenuAtPointer();
  const [menuTag, setMenuTag] = useState<TagRecord | null>(null);
  const [deleteTag, setDeleteTag] = useState<TagRecord | null>(null);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuTag(null);
  }, [menu]);

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
    return buildTagChipContextMenuRows({
      onShowInGallery: () => onShowInGallery(tag.id),
      onEdit: () => onEdit(tag),
      onDelete: () => setDeleteTag(tag)
    });
  }, [menuTag, onEdit, onShowInGallery]);

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
    </>
  );

  return {
    openTagContextMenu: openAtTag,
    contextMenuLayer
  };
}
