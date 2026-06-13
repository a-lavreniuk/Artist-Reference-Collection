type Props = {
  checked: boolean;
  className?: string;
};

/** Декоративный чекбокс 16×16 (Figma Checkbox, node 774:2185). Переключение — у родительской кнопки строки. */
export default function ArcCheckbox({ checked, className = '' }: Props) {
  return (
    <span
      className={`arc-checkbox${checked ? ' arc-checkbox--checked' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <span className="arc-checkbox__box" />
      {checked ? (
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
