import { useEffect, type ReactNode } from 'react';
import { useMountOverlayMotion } from './useMountOverlayMotion';

type Props = {
  onClose: () => void;
  className?: string;
  hostClassName?: string;
  children: (api: { requestClose: () => void }) => ReactNode;
};

/** Animated `.arc-modal-host` with exit tween before unmount. */
export default function ArcAnimatedModalHost({
  onClose,
  className = 'arc-modal-host',
  hostClassName = '',
  children
}: Props) {
  const { hostRef, requestClose, render } = useMountOverlayMotion(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  if (!render) return null;

  const rootClass = `${className}${hostClassName ? ` ${hostClassName}` : ''}`.trim();

  return (
    <div
      ref={hostRef as React.RefObject<HTMLDivElement>}
      className={rootClass}
      aria-hidden="false"
      style={{ willChange: 'opacity, transform' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {children({ requestClose })}
    </div>
  );
}
