import ArcCheckbox from '../ui/ArcCheckbox';
import ArcRadio from '../ui/ArcRadio';
import ArcToggle from './ArcToggle';
import type { SettingsControlVariant } from './SettingsControlRow';

type Props = {
  variant: SettingsControlVariant;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** Карточка опции с подписью (Figma Card 808:11068). Кликабельна целиком. */
export default function SettingsOptionCard({
  variant,
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange
}: Props) {
  const role = variant === 'toggle' ? 'switch' : variant === 'checkbox' ? 'checkbox' : 'radio';

  return (
    <button
      type="button"
      role={role}
      className={`arc-settings-option-card${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
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
      <span className="arc-settings-option-card__row">
        <span className="arc-settings-option-card__control" aria-hidden="true">
          {disabled ? (
            <span className="arc-check-lock" aria-hidden="true">
              <span className="arc-check-lock__shackle" />
              <span className="arc-check-lock__body" />
            </span>
          ) : null}
          {!disabled && variant === 'toggle' ? <ArcToggle pressed={checked} decorative /> : null}
          {!disabled && variant === 'checkbox' ? <ArcCheckbox checked={checked} /> : null}
          {!disabled && variant === 'radio' ? <ArcRadio checked={checked} /> : null}
        </span>
        <span className="arc-settings-option-card__label text-m">{label}</span>
      </span>
      <span className="arc-settings-option-card__description text-s">{description}</span>
    </button>
  );
}
