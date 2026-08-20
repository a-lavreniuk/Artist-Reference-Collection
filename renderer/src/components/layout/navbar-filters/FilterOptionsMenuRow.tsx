import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { GalleryFilterId } from '../../gallery/galleryFilterTypes';
import type { FilterOptionsDragState } from './useFilterOptionsDrag';

const DRAG_THRESHOLD_PX = 4;

type Props = {
  id: GalleryFilterId;
  label: string;
  visible: boolean;
  showEyeOff: boolean;
  visibilityDisabled: boolean;
  isDragging: boolean;
  insertBefore: boolean;
  onToggleVisibility: (id: GalleryFilterId) => void;
  onRowPointerDown: (args: {
    id: GalleryFilterId;
    label: string;
    visible: boolean;
    handleEl: HTMLElement;
    rowEl: HTMLElement;
  }) => void;
};

export default function FilterOptionsMenuRow({
  id,
  label,
  visible,
  showEyeOff,
  visibilityDisabled,
  isDragging,
  insertBefore,
  onToggleVisibility,
  onRowPointerDown
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const eyeIcon = showEyeOff ? 'arc-icon-eye-off' : 'arc-icon-eye';

  const bindRowPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !rowRef.current || !innerRef.current) return;
    if ((e.target as HTMLElement).closest('.context-menu__filter-row-visibility')) return;

    const innerEl = innerRef.current;
    const rowEl = rowRef.current;
    const originX = e.clientX;
    const originY = e.clientY;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (started) return;
      if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < DRAG_THRESHOLD_PX) return;
      started = true;
      try {
        innerEl.setPointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      onRowPointerDown({
        id,
        label,
        visible,
        handleEl: innerEl,
        rowEl
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={rowRef}
      className={`context-menu__filter-row${isDragging ? ' is-dragging' : ''}${insertBefore ? ' is-drop-before' : ''}`}
      role="presentation"
      data-filter-options-row={id}
    >
      <div
        ref={innerRef}
        className="context-menu__filter-row-inner"
        onPointerDown={bindRowPointerDown}
      >
        <span className="context-menu__filter-row-label">{label}</span>
        <button
          type="button"
          className="context-menu__filter-row-visibility"
          aria-label={visible ? `Скрыть ${label}` : `Показать ${label}`}
          aria-pressed={visible}
          disabled={visibilityDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(id);
          }}
        >
          <span
            className={`context-menu__filter-row-visibility-icon tab-icon ${eyeIcon}`}
            data-arc-icon-size="m"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

export function FilterOptionsMenuGhost({
  dragState
}: {
  dragState: FilterOptionsDragState;
}) {
  const eyeIcon = dragState.visible ? 'arc-icon-eye' : 'arc-icon-eye-off';

  return (
    <div
      className="context-menu__filter-row-ghost"
      style={{
        width: dragState.ghostWidth,
        transform: `translate(${dragState.ghostX}px, ${dragState.ghostY}px)`
      }}
      aria-hidden="true"
    >
      <div className="context-menu__filter-row-inner is-ghost">
        <span className="context-menu__filter-row-label">{dragState.label}</span>
        <span className={`context-menu__filter-row-visibility-icon tab-icon ${eyeIcon}`} data-arc-icon-size="m" />
      </div>
    </div>
  );
}
