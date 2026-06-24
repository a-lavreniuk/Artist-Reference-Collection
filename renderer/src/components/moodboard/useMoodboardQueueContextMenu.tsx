import { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '../context-menu';
import { useContextMenuAtPointer } from '../../hooks/useContextMenuAtPointer';
import { buildMoodboardQueueContextMenuRows } from './buildMoodboardQueueContextMenuRows';

type Props = {
  onOpen: (cardId: string) => void;
  onRemoveFromMoodboard: (cardId: string) => void | Promise<void>;
};

export function useMoodboardQueueContextMenu({ onOpen, onRemoveFromMoodboard }: Props) {
  const menu = useContextMenuAtPointer();
  const [menuCardId, setMenuCardId] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    menu.close();
    setMenuCardId(null);
  }, [menu]);

  const openAtCard = useCallback(
    (cardId: string, event: React.MouseEvent) => {
      menu.openAt(event);
      setMenuCardId(cardId);
    },
    [menu]
  );

  const menuRows = useMemo(() => {
    if (!menuCardId) return [];
    const id = menuCardId;
    return buildMoodboardQueueContextMenuRows({
      onOpen: () => onOpen(id),
      onRemoveFromMoodboard: () => void onRemoveFromMoodboard(id)
    });
  }, [menuCardId, onOpen, onRemoveFromMoodboard]);

  const contextMenuLayer = (
    <ContextMenu
      open={menu.open && menuCardId !== null}
      position={menu.position}
      onClose={closeMenu}
      ariaLabel="Действия с карточкой в очереди"
      rows={menuRows}
    />
  );

  return {
    openQueueCardContextMenu: openAtCard,
    contextMenuLayer
  };
}
