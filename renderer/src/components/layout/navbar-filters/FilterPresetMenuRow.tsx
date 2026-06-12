type Props = {
  name: string;
  onApply: () => void;
  onEdit: () => void;
};

export default function FilterPresetMenuRow({ name, onApply, onEdit }: Props) {
  return (
    <div className="context-menu__preset-row" role="presentation">
      <div className="context-menu__preset-row-group arc-navbar-no-drag">
        <button type="button" role="menuitem" className="context-menu__preset-row-apply" onClick={onApply}>
          <span className="context-menu__preset-row-label">{name}</span>
        </button>
        <button
          type="button"
          className="context-menu__preset-row-edit"
          aria-label={`Изменить пресет ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <span
            className="context-menu__preset-row-edit-icon tab-icon arc-icon-edit"
            data-arc-icon-size="m"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
