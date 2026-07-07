import { useCallback, useState } from 'react';
import { useOverlayMotionPair } from './useOverlayMotion';
import type { OverlayMotionPreset } from './arcMotionTokens';

/** For modals mounted via `{open ? <Modal onClose /> : null}` — plays exit tween before onClose. */
export function useMountOverlayMotion(
  onClose: () => void,
  preset: OverlayMotionPreset = 'fade-scale'
) {
  const [closing, setClosing] = useState(false);
  const { panelRef, render } = useOverlayMotionPair(!closing, {
    preset,
    onExitComplete: onClose
  });

  const requestClose = useCallback(() => {
    setClosing(true);
  }, []);

  return { hostRef: panelRef, requestClose, render };
}
