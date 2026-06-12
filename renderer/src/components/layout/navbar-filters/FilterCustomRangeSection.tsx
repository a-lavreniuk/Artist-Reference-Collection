import { useCallback, useEffect, useState } from 'react';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import RangeSlider from '../../range-slider/RangeSlider';

type Props = {
  header: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  ariaLabel?: string;
  headerClassName?: string;
};

function clampInt(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function normalizeRange(min: number, max: number, valueMin: number, valueMax: number) {
  const lo = clampInt(valueMin, min, max);
  const hi = clampInt(valueMax, min, max);
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

export default function FilterCustomRangeSection({
  header,
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  ariaLabel,
  headerClassName
}: Props) {
  const { lo, hi } = normalizeRange(min, max, valueMin, valueMax);
  const [minInput, setMinInput] = useState(String(lo));
  const [maxInput, setMaxInput] = useState(String(hi));

  useEffect(() => {
    setMinInput(String(lo));
    setMaxInput(String(hi));
  }, [lo, hi]);

  const emitChange = useCallback(
    (nextMin: number, nextMax: number) => {
      const next = normalizeRange(min, max, nextMin, nextMax);
      onChange(next.lo, next.hi);
    },
    [max, min, onChange]
  );

  const handleMinInputChange = (raw: string) => {
    setMinInput(raw);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    emitChange(parsed, hi);
  };

  const handleMaxInputChange = (raw: string) => {
    setMaxInput(raw);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    emitChange(lo, parsed);
  };

  const clearMin = () => {
    setMinInput(String(min));
    emitChange(min, hi);
  };

  const clearMax = () => {
    setMaxInput(String(max));
    emitChange(lo, max);
  };

  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuHeader className={headerClassName}>{header}</ContextMenuHeader>
      <div className="context-menu__slot arc-filter-custom-range__slider arc-navbar-no-drag">
        <RangeSlider
          size="s"
          min={min}
          max={max}
          step={1}
          valueMin={lo}
          valueMax={hi}
          showValues={false}
          formatValue={(v) => String(v)}
          onChange={emitChange}
          ariaLabel={ariaLabel ?? header}
        />
      </div>
      <div
        className="context-menu__slot arc-filter-custom-range__inputs arc-ui-kit-scope arc-navbar-no-drag"
        data-input-size="s"
      >
        <label
          className={`field input-live${lo !== min ? ' has-value' : ''}`}
          data-live-input
        >
          <input
            type="text"
            inputMode="numeric"
            className="input"
            value={minInput}
            aria-label="Минимум"
            onChange={(e) => handleMinInputChange(e.target.value)}
          />
          <button
            type="button"
            className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
            aria-label="Сбросить минимум"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearMin();
            }}
          />
        </label>
        <span className="arc-filter-custom-range__input-sep" aria-hidden="true">
          ×
        </span>
        <label
          className={`field input-live${hi !== max ? ' has-value' : ''}`}
          data-live-input
        >
          <input
            type="text"
            inputMode="numeric"
            className="input"
            value={maxInput}
            aria-label="Максимум"
            onChange={(e) => handleMaxInputChange(e.target.value)}
          />
          <button
            type="button"
            className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
            aria-label="Сбросить максимум"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearMax();
            }}
          />
        </label>
      </div>
    </>
  );
}
