import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  playModalHostEnterWhenVisible,
  playModalHostExit,
  resolveModalMotionTarget
} from './playModalHostMotion';

/** For modals mounted via `{open ? <Modal onClose /> : null}` — plays exit tween before onClose. */
export function useMountOverlayMotion(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const [render, setRender] = useState(true);
  const hostRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    setClosing(true);
  }, []);

  useLayoutEffect(() => {
    if (!render || closing) return;
    const host = hostRef.current;
    if (!host) return;
    return playModalHostEnterWhenVisible(host);
  }, [render, closing]);

  useLayoutEffect(() => {
    if (!closing) return;
    const host = hostRef.current;
    if (!host) {
      setRender(false);
      onCloseRef.current();
      return;
    }
    playModalHostExit(resolveModalMotionTarget(host), () => {
      setRender(false);
      onCloseRef.current();
    });
  }, [closing]);

  return { hostRef, requestClose, render, closing };
}
