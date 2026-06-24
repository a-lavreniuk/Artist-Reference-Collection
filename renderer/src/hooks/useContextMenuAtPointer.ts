import { useCallback, useState } from 'react';
import type { ContextMenuPosition } from '../components/context-menu';

type PointerMenuState = {
  open: true;
  position: ContextMenuPosition;
};

export function useContextMenuAtPointer() {
  const [state, setState] = useState<PointerMenuState | null>(null);

  const openAt = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ open: true, position: { x: event.clientX, y: event.clientY } });
  }, []);

  const close = useCallback(() => {
    setState(null);
  }, []);

  return {
    open: state?.open ?? false,
    position: state?.position ?? null,
    openAt,
    close
  };
}
