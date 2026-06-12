type Props = {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
};

/** Строка sidebar категорий — те же токены, что в модалке меток на детальной карточке. */
export default function TagsSidebarPickerItem({ label, count, active, onSelect }: Props) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item${active ? ' is-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="context-menu__item-inner">
        <span className="context-menu__item-label-cluster">
          <span className="context-menu__item-label">{label}</span>
        </span>
        {count !== undefined ? <span className="context-menu__item-counter">{count}</span> : null}
      </span>
    </button>
  );
}
