type Props = {
  pressed: boolean;
  disabled?: boolean;
  decorative?: boolean;
  className?: string;
  'aria-label'?: string;
  onPressedChange?: (pressed: boolean) => void;
};

/** Переключатель 16×16 (Figma Toggle, node 808:3941). */
export default function ArcToggle({
  pressed,
  disabled = false,
  decorative = false,
  className = '',
  'aria-label': ariaLabel,
  onPressedChange
}: Props) {
  const classNames = `arc-toggle${pressed ? ' arc-toggle--on' : ''}${disabled ? ' arc-toggle--disabled' : ''}${decorative ? ' arc-toggle--decorative' : ''}${className ? ` ${className}` : ''}`;

  if (decorative) {
    return (
      <span className={classNames} aria-hidden="true">
        <span className="arc-toggle__track" />
        <span className="arc-toggle__thumb" />
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      className={classNames}
      aria-checked={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onPressedChange?.(!pressed);
      }}
    >
      <span className="arc-toggle__track" aria-hidden="true" />
      <span className="arc-toggle__thumb" aria-hidden="true" />
    </button>
  );
}
