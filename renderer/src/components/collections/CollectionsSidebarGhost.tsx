import type { CollectionsDragState } from './useCollectionsDrag';

type Props = {
  dragState: CollectionsDragState;
};

export default function CollectionsSidebarGhost({ dragState }: Props) {
  return (
    <div
      className="arc-tags-sidebar-row-ghost"
      style={{
        left: dragState.ghostX,
        top: dragState.ghostY,
        width: dragState.ghostWidth
      }}
      aria-hidden
    >
      <div className="context-menu__item-inner arc-tags-sidebar-row-inner is-ghost">
        <span
          className="context-menu__item-icon tab-icon arc-icon-chevrons-up-down"
          data-arc-icon-size="m"
          aria-hidden="true"
        />
        <span className="context-menu__item-label-cluster">
          <span className="context-menu__item-label">{dragState.label}</span>
        </span>
        <span className="context-menu__item-counter">{dragState.count}</span>
      </div>
    </div>
  );
}
