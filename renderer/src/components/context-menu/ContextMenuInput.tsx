type Props = {
  variant: 'live' | 'search' | 'textarea';
  label?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

export default function ContextMenuInput({
  variant,
  label,
  placeholder,
  value,
  disabled,
  onChange
}: Props) {
  if (variant === 'search') {
    return (
      <div className="context-menu__slot">
        <div className="input search-field input-slots">
          <span className="search-icon slot-leading" aria-hidden="true" />
          <input
            className="search-inner slot-value"
            placeholder={placeholder ?? 'Search'}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (variant === 'textarea') {
    return (
      <div className="context-menu__slot">
        <label className="field">
          <textarea
            className="input textarea"
            placeholder={placeholder ?? label ?? 'Ключевые слова'}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="context-menu__slot">
      <label className="field input-live">
        <input
          className="input"
          placeholder={placeholder ?? label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
    </div>
  );
}
