import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../../context-menu';
import { useContextMenuAtPointer } from '../../../hooks/useContextMenuAtPointer';
import ConfirmDeletePresetModal from '../ConfirmDeletePresetModal';
import type { SavedFilterPreset } from '../../gallery/galleryFilterTypes';
import { buildFilterPresetContextMenuRows } from './buildFilterPresetContextMenuRows';

type Props = {
  onApply: (preset: SavedFilterPreset) => void;
  onRename: (preset: SavedFilterPreset) => void;
  onDelete: (presetId: string) => void | Promise<void>;
};

export function useFilterPresetContextMenu({ onApply, onRename, onDelete }: Props) {
  const menu = useContextMenuAtPointer();
  const [menuPreset, setMenuPreset] = useState<SavedFilterPreset | null>(null);
  const [deletePreset, setDeletePreset] = useState<SavedFilterPreset | null>(null);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuPreset(null);
  }, [menu]);

  const openAtPreset = useCallback(
    (preset: SavedFilterPreset, event: React.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.context-menu__preset-row-edit')) {
        return;
      }
      menu.openAt(event);
      setMenuPreset(preset);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuPreset) return [];
    const preset = menuPreset;
    return buildFilterPresetContextMenuRows({
      onApply: () => onApply(preset),
      onRename: () => onRename(preset),
      onDelete: () => setDeletePreset(preset)
    });
  }, [menuPreset, onApply, onDelete, onRename]);

  const contextMenuLayer = (
    <>
      <ContextMenu
        open={menu.open && menuPreset !== null}
        position={menu.position}
        onClose={closeMenu}
        ariaLabel="Действия с пресетом"
        rows={menuRows}
        noDragClassName="arc-navbar-no-drag"
      />

      {deletePreset ? (
        <ConfirmDeletePresetModal
          presetName={deletePreset.name}
          onClose={() => setDeletePreset(null)}
          onConfirm={async () => {
            await onDelete(deletePreset.id);
          }}
        />
      ) : null}
    </>
  );

  return {
    openPresetContextMenu: openAtPreset,
    contextMenuLayer
  };
}
