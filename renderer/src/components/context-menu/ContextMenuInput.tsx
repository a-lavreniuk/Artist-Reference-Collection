import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

type Props = {
  variant: 'live' | 'search' | 'textarea';
  label?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  slotClassName?: string;
  autoGrow?: boolean;
  autoGrowMinPx?: number;
  autoGrowMaxPx?: number;
  onChange?: (value: string) => void;
};

/** Шорткаты окна (Space и др.) не должны перехватывать ввод в меню. */
function stopMenuInputKeys(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.stopPropagation();
}

export default function ContextMenuInput({
  variant,
  label,
  placeholder,
  value,
  disabled,
  autoFocus,
  slotClassName = '',
  autoGrow = false,
  autoGrowMinPx = 64,
  autoGrowMaxPx = 234,
  onChange
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slotClass = ['context-menu__slot', slotClassName].filter(Boolean).join(' ');

  const syncTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    el.classList.remove('is-scrollable');
    const scrollH = el.scrollHeight;
    const next = Math.min(autoGrowMaxPx, Math.max(autoGrowMinPx, scrollH));
    el.style.height = `${next}px`;
    if (scrollH > autoGrowMaxPx) {
      el.classList.add('is-scrollable');
    }
  };

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [value, autoGrow, autoGrowMinPx, autoGrowMaxPx]);

  if (variant === 'search') {
    return (
      <div className={slotClass}>
        <div className="input search-field input-slots">
          <span className="search-icon slot-leading" aria-hidden="true" />
          <input
            className="search-inner slot-value"
            placeholder={placeholder ?? 'Search'}
            value={value}
            autoFocus={autoFocus}
            onKeyDown={stopMenuInputKeys}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (variant === 'textarea') {
    return (
      <div className={slotClass}>
        <label className="field">
          <textarea
            ref={textareaRef}
            className={`input textarea${autoGrow ? ' arc-context-menu-textarea-autogrow' : ''}`}
            placeholder={placeholder ?? label ?? 'Ключевые слова'}
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onKeyDown={stopMenuInputKeys}
            onChange={(e) => {
              onChange?.(e.target.value);
              syncTextareaHeight();
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className={slotClass}>
      <label className={`field input-live${value && value.length > 0 ? ' has-value' : ''}`}>
        <input
          className="input"
          placeholder={placeholder ?? label}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={stopMenuInputKeys}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
    </div>
  );
}
