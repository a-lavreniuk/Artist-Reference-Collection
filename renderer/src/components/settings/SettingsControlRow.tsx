import ArcCheckbox from '../ui/ArcCheckbox';
import ArcRadio from '../ui/ArcRadio';
import ArcToggle from './ArcToggle';

export type SettingsControlVariant = 'toggle' | 'checkbox' | 'radio';

type Props = {
  variant: SettingsControlVariant;
  label: string;
  checked: boolean;
  disabled?: boolean;
  labelSize?: 'm' | 's';
  onCheckedChange?: (checked: boolean) => void;
};

/** Строка настройки: кликабельны control, gap и label — без пустого поля справа (Figma Row 808:10987). */
export default function SettingsControlRow({
  variant,
  label,
  checked,
  disabled = false,
  labelSize = 'm',
  onCheckedChange
}: Props) {
  const role = variant === 'toggle' ? 'switch' : variant === 'checkbox' ? 'checkbox' : 'radio';

  return (
    <button
      type="button"
      role={role}
      className={`arc-settings-check-row${disabled ? ' arc-settings-check-row--disabled' : ''}`}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (variant === 'radio') {
          onCheckedChange?.(true);
          return;
        }
        onCheckedChange?.(!checked);
      }}
    >
      <span className="arc-settings-check-row__control" aria-hidden="true">
        {variant === 'toggle' ? (
          <ArcToggle pressed={checked} disabled={disabled} decorative />
        ) : null}
        {variant === 'checkbox' ? <ArcCheckbox checked={checked} /> : null}
        {variant === 'radio' ? <ArcRadio checked={checked} /> : null}
      </span>
      <span
        className={`arc-settings-check-row__label${labelSize === 's' ? ' arc-settings-check-row__label--s' : ''}`}
      >
        {label}
      </span>
    </button>
  );
}
