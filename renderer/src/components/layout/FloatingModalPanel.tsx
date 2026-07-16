import {
  forwardRef,
  useCallback,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref
} from 'react';
import { useFloatingPanelGeometry } from '../../hooks/useFloatingPanelGeometry';

const DEFAULT_MOVE_ALLOW = ['.arc-modal__header'];
const DEFAULT_SCROLL_BLOCK = ['.arc-modal__body'];

/** Default CSS width of `.arc-modal` in arc-ui.css */
export const ARC_MODAL_DEFAULT_WIDTH = 400;
/** Approximate default height before measure (centering fallback). */
export const ARC_MODAL_DEFAULT_HEIGHT = 280;

type Props = {
  /** Stable session key for position memory. */
  panelId: string;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section';
  moveAllowSelectors?: string[];
  scrollBlockSelectors?: string[];
  defaultWidth?: number;
  defaultHeight?: number;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else ref.current = value;
}

/**
 * Draggable `.arc-modal` panel shell (move only).
 * Use inside `ArcAnimatedModalHost` with floating host layout.
 */
const FloatingModalPanel = forwardRef<HTMLElement, Props>(function FloatingModalPanel(
  {
    panelId,
    children,
    className = 'arc-modal',
    as: Tag = 'section',
    moveAllowSelectors = DEFAULT_MOVE_ALLOW,
    scrollBlockSelectors = DEFAULT_SCROLL_BLOCK,
    defaultWidth = ARC_MODAL_DEFAULT_WIDTH,
    defaultHeight = ARC_MODAL_DEFAULT_HEIGHT,
    style,
    onClick,
    onPointerDown: onPointerDownProp,
    onPointerMove: onPointerMoveProp,
    onPointerUp: onPointerUpProp,
    onPointerCancel: onPointerCancelProp,
    onPointerLeave: onPointerLeaveProp,
    ...rest
  },
  forwardedRef
) {
  const {
    panelRef,
    style: geoStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave
  } = useFloatingPanelGeometry({
    panelId,
    defaultWidth,
    defaultHeight,
    resizable: false,
    moveAllowSelectors,
    scrollBlockSelectors
  });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      (panelRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node as HTMLDivElement | null;
      assignRef(forwardedRef, node);
    },
    [forwardedRef, panelRef]
  );

  const mergedStyle = { ...geoStyle, ...style } as CSSProperties;

  return (
    <Tag
      ref={setRefs as never}
      className={className}
      style={mergedStyle}
      onClick={onClick}
      onPointerDown={(e) => {
        onPointerDown(e);
        onPointerDownProp?.(e);
      }}
      onPointerMove={(e) => {
        onPointerMove(e);
        onPointerMoveProp?.(e);
      }}
      onPointerUp={(e) => {
        onPointerUp(e);
        onPointerUpProp?.(e);
      }}
      onPointerCancel={(e) => {
        onPointerCancel(e);
        onPointerCancelProp?.(e);
      }}
      onPointerLeave={(e) => {
        onPointerLeave();
        onPointerLeaveProp?.(e);
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default FloatingModalPanel;
