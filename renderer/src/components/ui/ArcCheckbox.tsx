type Props = {
  checked: boolean;
  indeterminate?: boolean;
  className?: string;
};

/** Декоративный чекбокс 16×16 (Figma Checkbox, node 774:2185). Переключение — у родительской кнопки строки. */
export default function ArcCheckbox({ checked, indeterminate = false, className = '' }: Props) {
  const showCheck = checked && !indeterminate;
  return (
    <span
      className={`arc-checkbox${showCheck ? ' arc-checkbox--checked' : ''}${indeterminate ? ' arc-checkbox--indeterminate' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <span className="arc-checkbox__box" />
      {indeterminate ? (
        <span className="arc-checkbox__dash" aria-hidden="true" />
      ) : showCheck ? (
        <span className="arc-checkbox__check" aria-hidden="true">
          <svg viewBox="0 0 8 6" fill="none" aria-hidden="true">
            <path
              d="M7.5 0.5L3.5 5.5L0.5 2.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
    </span>
  );
}
