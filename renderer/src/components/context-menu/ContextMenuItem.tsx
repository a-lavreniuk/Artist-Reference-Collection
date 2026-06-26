import { Loader } from '../loader';
import { DEFAULT_CONTEXT_MENU_SLOT_ORDER, type ContextMenuSlot } from './types';

export type ContextMenuItemProps = {
  label: string;
  iconClass?: string;
  shortcut?: string;
  counter?: string | number;
  slotOrder?: ContextMenuSlot[];
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  menuKey?: string;
  onSelect?: () => void;
};

function renderSlot(slot: ContextMenuSlot, props: ContextMenuItemProps) {
  switch (slot) {
    case 'icon':
      if (props.loading) {
        return <Loader decorative key="icon" />;
      }
      return props.iconClass ? (
        <span
          className={`context-menu__item-icon tab-icon ${props.iconClass}`}
          data-arc-icon-size="m"
          aria-hidden="true"
          key="icon"
        />
      ) : null;
    case 'label':
      return (
        <span className="context-menu__item-label-cluster" key="label">
          <span className="context-menu__item-label">{props.label}</span>
          {props.selected ? (
            <span
              className="context-menu__item-check tab-icon arc-icon-check"
              data-arc-icon-size="m"
              aria-hidden="true"
            />
          ) : null}
        </span>
      );
    case 'counter':
      return props.counter != null && props.counter !== '' ? (
        <span className="context-menu__item-counter" key="counter">
          {props.counter}
        </span>
      ) : null;
    case 'shortcut':
      return props.shortcut ? (
        <span className="context-menu__item-shortcut" key="shortcut">
          {props.shortcut}
        </span>
      ) : null;
    default:
      return null;
  }
}

export default function ContextMenuItem({
  label,
  iconClass,
  shortcut,
  counter,
  slotOrder = DEFAULT_CONTEXT_MENU_SLOT_ORDER,
  selected,
  disabled,
  loading,
  menuKey,
  onSelect
}: ContextMenuItemProps) {
  const order = slotOrder ?? DEFAULT_CONTEXT_MENU_SLOT_ORDER;

  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item${disabled ? ' is-disabled' : ''}`}
      data-context-menu-key={menuKey}
      disabled={disabled || loading}
      onClick={() => {
        if (disabled || loading) return;
        onSelect?.();
      }}
    >
      <span className="context-menu__item-inner">
        {order.map((slot) =>
          renderSlot(slot, { label, iconClass, shortcut, counter, slotOrder, selected, disabled, loading, onSelect })
        )}
      </span>
    </button>
  );
}
