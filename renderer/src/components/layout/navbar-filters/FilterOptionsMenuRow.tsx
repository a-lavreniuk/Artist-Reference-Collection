import { useRef } from 'react';
import type { GalleryFilterId } from '../../gallery/galleryFilterTypes';
import type { FilterOptionsDragState } from './useFilterOptionsDrag';

type Props = {
  id: GalleryFilterId;
  label: string;
  visible: boolean;
  showEyeOff: boolean;
  visibilityDisabled: boolean;
  isDragging: boolean;
  insertBefore: boolean;
  onToggleVisibility: (id: GalleryFilterId) => void;
  onHandlePointerDown: (args: {
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
  onHandlePointerDown
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const eyeIcon = showEyeOff ? 'arc-icon-eye-off' : 'arc-icon-eye';

  return (
    <div
      ref={rowRef}
      className={`context-menu__filter-row${isDragging ? ' is-dragging' : ''}${insertBefore ? ' is-drop-before' : ''}`}
      role="presentation"
      data-filter-options-row={id}
    >
      <div className="context-menu__filter-row-inner">
        <button
          ref={handleRef}
          type="button"
          className="context-menu__filter-row-handle"
          aria-label={`Переместить ${label}`}
          onPointerDown={(e) => {
            if (e.button !== 0 || !rowRef.current || !handleRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            handleRef.current.setPointerCapture(e.pointerId);
            onHandlePointerDown({
              id,
              label,
              visible,
              handleEl: handleRef.current,
              rowEl: rowRef.current
            });
          }}
        >
          <span
            className="context-menu__filter-row-handle-icon tab-icon arc-icon-chevrons-up-down"
            data-arc-icon-size="m"
            aria-hidden="true"
          />
        </button>
        <span className="context-menu__filter-row-label">{label}</span>
        <button
          type="button"
          className="context-menu__filter-row-visibility"
          aria-label={visible ? `Скрыть ${label}` : `Показать ${label}`}
          aria-pressed={visible}
          disabled={visibilityDisabled}
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
        <span className="context-menu__filter-row-handle-icon tab-icon arc-icon-chevrons-up-down" data-arc-icon-size="m" />
        <span className="context-menu__filter-row-label">{dragState.label}</span>
        <span className={`context-menu__filter-row-visibility-icon tab-icon ${eyeIcon}`} data-arc-icon-size="m" />
      </div>
    </div>
  );
}
