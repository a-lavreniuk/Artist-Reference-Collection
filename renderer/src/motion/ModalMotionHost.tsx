import type { CSSProperties, ReactNode } from 'react';
import { useOverlayMotionPair } from './useOverlayMotion';
import type { OverlayMotionPreset } from './arcMotionTokens';

type Props = {
  open?: boolean;
  onClose?: () => void;
  className?: string;
  hostClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Backdrop click closes when onClose provided */
  dismissOnBackdrop?: boolean;
  panelMotion?: OverlayMotionPreset;
  backdropMotion?: OverlayMotionPreset;
  /** When false, always render (legacy instant modals controlled by parent conditional) */
  animate?: boolean;
  role?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

export default function ModalMotionHost({
  open = true,
  onClose,
  className = 'arc-modal-host',
  hostClassName = '',
  style,
  children,
  dismissOnBackdrop = true,
  panelMotion = 'fade-scale',
  backdropMotion = 'fade-scale',
  animate = true,
  role,
  'aria-hidden': ariaHidden,
  onClick
}: Props) {
  const { panelRef, backdropRef, render } = useOverlayMotionPair(open, {
    preset: panelMotion,
    backdropPreset: backdropMotion
  });

  if (!animate) {
    if (!open) return null;
    return (
      <div
        className={`${className}${hostClassName ? ` ${hostClassName}` : ''}`}
        style={style}
        aria-hidden={ariaHidden}
        onClick={(e) => {
          onClick?.(e);
          if (dismissOnBackdrop && onClose && e.target === e.currentTarget) onClose();
        }}
      >
        {children}
      </div>
    );
  }

  if (!render) return null;

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      className={`${className}${hostClassName ? ` ${hostClassName}` : ''}`}
      style={{ ...style, willChange: 'opacity, transform' }}
      role={role}
      aria-hidden={ariaHidden}
      onClick={(e) => {
        onClick?.(e);
        if (dismissOnBackdrop && onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

/** Optional dim backdrop layer inside modal host (card detail uses separate backdrop) */
export function ModalMotionBackdrop({
  open = true,
  className = 'arc-modal-backdrop-motion',
  onClose
}: {
  open?: boolean;
  className?: string;
  onClose?: () => void;
}) {
  const { backdropRef, render } = useOverlayMotionPair(open, {
    preset: 'fade-scale',
    backdropPreset: 'fade-scale'
  });
  if (!render) return null;
  return (
    <button
      type="button"
      ref={backdropRef as React.RefObject<HTMLButtonElement>}
      className={className}
      aria-label="Закрыть"
      onClick={onClose}
    />
  );
}
