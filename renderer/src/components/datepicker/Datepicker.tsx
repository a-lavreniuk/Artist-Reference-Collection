import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import DateRangeModal from '../calendar/DateRangeModal';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import {
  formatDateRangeDisplay,
  getDatepickerPlaceholder,
  parseDateRangeText,
  type DatepickerMode,
  type DateRangeValue
} from './dateRangeText';

const DEBOUNCE_MS = 400;
const RANGE_SEPARATOR = ' — ';

export type DatepickerSize = 'l' | 'm' | 's';

type Props = {
  size?: DatepickerSize;
  mode: DatepickerMode;
  value?: { from: string; to?: string } | null;
  onChange?: (value: DateRangeValue | null) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

export default function Datepicker({
  size = 'm',
  mode,
  value = null,
  onChange,
  disabled = false,
  error = false,
  placeholder,
  className = '',
  'aria-label': ariaLabel
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => formatDateRangeDisplay(value, mode));
  const [internalError, setInternalError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const debouncedText = useDebouncedValue(text, DEBOUNCE_MS);
  const displayPlaceholder = placeholder ?? getDatepickerPlaceholder(mode);
  const formattedValue = formatDateRangeDisplay(value, mode);
  const showError = error || internalError;

  const applyMaskedInput = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '');
    const maxDigits = mode === 'single' ? 8 : 16;
    const digits = digitsOnly.slice(0, maxDigits);
    const formatDatePart = (part: string) => {
      if (!part) return '';
      const dd = part.slice(0, 2);
      const mm = part.slice(2, 4);
      const yyyy = part.slice(4, 8);
      let out = dd;
      if (part.length > 2) out += `.${mm}`;
      if (part.length > 4) out += `.${yyyy}`;
      return out;
    };

    if (mode === 'single') {
      setText(formatDatePart(digits));
      return;
    }

    const fromPart = digits.slice(0, 8);
    const toPart = digits.slice(8, 16);
    const fromText = formatDatePart(fromPart);
    if (!toPart) {
      setText(fromText);
      return;
    }
    setText(`${fromText}${RANGE_SEPARATOR}${formatDatePart(toPart)}`);
  };

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [showError, disabled, size, text]);

  useEffect(() => {
    setText(formattedValue);
    setInternalError(false);
  }, [formattedValue]);

  useEffect(() => {
    if (debouncedText !== text) return;
    if (debouncedText === formattedValue) return;
    if (disabled) return;
    const digitCount = debouncedText.replace(/\D/g, '').length;

    if (mode === 'single' && digitCount > 0 && digitCount < 8) {
      setInternalError(false);
      return;
    }
    if (mode === 'range' && digitCount > 0 && digitCount < 16) {
      setInternalError(false);
      return;
    }
    if (mode === 'optional_range' && digitCount > 0 && digitCount !== 8 && digitCount < 16) {
      setInternalError(false);
      return;
    }

    const parsed = parseDateRangeText(debouncedText, mode);
    if (parsed === 'empty') {
      setInternalError(false);
      onChange?.(null);
      return;
    }
    if (parsed === null) {
      setInternalError(true);
      return;
    }
    setInternalError(false);
    onChange?.(parsed);
  }, [debouncedText, text, formattedValue, mode, onChange, disabled]);

  const handleClear = () => {
    if (disabled) return;
    setText('');
    setInternalError(false);
    onChange?.(null);
  };

  const rootClass = [
    'arc-datepicker',
    'input-slots',
    `arc-datepicker--${size}`,
    text.trim() ? 'arc-datepicker--has-value' : '',
    showError ? 'arc-datepicker--error' : '',
    disabled ? 'arc-datepicker--disabled' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div ref={hostRef} className={rootClass} data-input-size={size}>
        <input
          className="arc-datepicker__input slot-value"
          type="text"
          value={text}
          disabled={disabled}
          placeholder={displayPlaceholder}
          aria-label={ariaLabel ?? displayPlaceholder}
          aria-invalid={showError || undefined}
          inputMode="numeric"
          onChange={(e) => applyMaskedInput(e.target.value)}
        />
        <span className="selector-actions slot-trailing arc-datepicker__actions">
          <button
            type="button"
            className="arc-datepicker__clear"
            disabled={disabled || !text.trim()}
            aria-label="Очистить"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <span
              className="selector-clear arc-icon-close"
              data-arc-icon-size={size === 's' ? 's' : 'm'}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="arc-datepicker__trigger"
            disabled={disabled}
            aria-label="Открыть календарь"
            onClick={() => setModalOpen(true)}
          >
            <span
              className="arc-icon-calendar arc-datepicker__icon"
              data-arc-icon-size={size === 's' ? 's' : 'm'}
              aria-hidden="true"
            />
          </button>
        </span>
      </div>

      <DateRangeModal
        open={modalOpen}
        mode={mode}
        value={value}
        onClose={() => setModalOpen(false)}
        onApply={(next) => {
          setText(formatDateRangeDisplay(next, mode));
          setInternalError(false);
          onChange?.(next);
        }}
      />
    </>
  );
}
