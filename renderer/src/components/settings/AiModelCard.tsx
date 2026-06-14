import type { ReactNode } from 'react';
import ArcCheckbox from '../ui/ArcCheckbox';
import ArcRadio from '../ui/ArcRadio';
import type { SettingsControlVariant } from './SettingsControlRow';

type Props = {
  variant: SettingsControlVariant;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  actions?: ReactNode;
};

/** Карточка модели AI: выбор + кнопки управления внутри одной рамки (Figma 1396:12789). */
export default function AiModelCard({
  variant,
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
  actions
}: Props) {
  const role = variant === 'checkbox' ? 'checkbox' : 'radio';

  return (
    <div
      className={`arc-settings-ai-model-card${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <button
        type="button"
        role={role}
        className="arc-settings-ai-model-card__select"
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
            {!disabled && variant === 'checkbox' ? <ArcCheckbox checked={checked} /> : null}
            {!disabled && variant === 'radio' ? <ArcRadio checked={checked} /> : null}
          </span>
          <span className="arc-settings-option-card__label typo-p-m">{label}</span>
        </span>
        <span className="arc-settings-option-card__description typo-p-s">{description}</span>
      </button>
      {actions ? (
        <div className="arc-settings-ai-model-card__actions arc-ui-kit-scope" data-btn-size="s">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
