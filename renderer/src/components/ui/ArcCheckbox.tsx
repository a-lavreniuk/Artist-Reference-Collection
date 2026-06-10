type Props = {
  checked: boolean;
  className?: string;
};

/** Декоративный чекбокс 16×16 (Figma Checkbox); переключение — у родительской кнопки строки. */
export default function ArcCheckbox({ checked, className = '' }: Props) {
  return (
    <span
      className={`arc-checkbox${checked ? ' arc-checkbox--checked' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {checked ? (
        <span className="arc-checkbox__check tab-icon arc-icon-check" data-arc-icon-size="s" aria-hidden="true" />
      ) : null}
    </span>
  );
}
