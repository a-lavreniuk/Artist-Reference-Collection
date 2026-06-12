import { useCallback, useEffect, useRef, useState } from 'react';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';

export type ResolutionRangeValues = {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
};

type Props = {
  value: ResolutionRangeValues;
  maxBoundW: number;
  maxBoundH: number;
  onChange: (next: ResolutionRangeValues) => void;
};

function clampInt(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function normalizeAxis(min: number, max: number, boundMin: number, boundMax: number) {
  const lo = clampInt(min, boundMin, boundMax);
  const hi = clampInt(max, boundMin, boundMax);
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

function formatAxisInput(value: number, bound: number): string {
  return value !== bound ? String(value) : '';
}

type AxisRowProps = {
  iconClass: string;
  boundMin: number;
  boundMax: number;
  valueMin: number;
  valueMax: number;
  minAriaLabel: string;
  maxAriaLabel: string;
  onChange: (min: number, max: number) => void;
};

function ResolutionAxisRow({
  iconClass,
  boundMin,
  boundMax,
  valueMin,
  valueMax,
  minAriaLabel,
  maxAriaLabel,
  onChange
}: AxisRowProps) {
  const { lo, hi } = normalizeAxis(valueMin, valueMax, boundMin, boundMax);
  const [minInput, setMinInput] = useState(() => formatAxisInput(lo, boundMin));
  const [maxInput, setMaxInput] = useState(() => formatAxisInput(hi, boundMax));
  const minFocusedRef = useRef(false);
  const maxFocusedRef = useRef(false);

  useEffect(() => {
    if (!minFocusedRef.current) {
      setMinInput(formatAxisInput(lo, boundMin));
    }
    if (!maxFocusedRef.current) {
      setMaxInput(formatAxisInput(hi, boundMax));
    }
  }, [lo, hi, boundMin, boundMax]);

  const emitChange = useCallback(
    (nextMin: number, nextMax: number) => {
      const next = normalizeAxis(nextMin, nextMax, boundMin, boundMax);
      onChange(next.lo, next.hi);
    },
    [boundMax, boundMin, onChange]
  );

  return (
    <div className="arc-filter-resolution-custom__row">
      <span
        className={`arc-filter-resolution-custom__icon ${iconClass}`}
        data-arc-icon-size="s"
        aria-hidden="true"
      />
      <div className="arc-filter-resolution-custom__inputs">
        <label
          className={`field input-live${lo !== boundMin ? ' has-value' : ''}`}
          data-live-input
        >
          <input
            type="text"
            inputMode="numeric"
            className="input"
            value={minInput}
            placeholder={String(boundMin)}
            aria-label={minAriaLabel}
            onFocus={() => {
              minFocusedRef.current = true;
            }}
            onBlur={() => {
              minFocusedRef.current = false;
              const raw = minInput.trim();
              if (raw === '') {
                setMinInput('');
                emitChange(boundMin, hi);
                return;
              }
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) {
                setMinInput(formatAxisInput(lo, boundMin));
                return;
              }
              emitChange(parsed, hi);
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setMinInput(raw);
              if (raw.trim() === '') return;
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) return;
              emitChange(parsed, hi);
            }}
          />
          <button
            type="button"
            className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
            aria-label={`Сбросить ${minAriaLabel.toLowerCase()}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMinInput('');
              emitChange(boundMin, hi);
            }}
          />
        </label>
        <span className="arc-filter-custom-range__input-sep" aria-hidden="true">
          ×
        </span>
        <label
          className={`field input-live${hi !== boundMax ? ' has-value' : ''}`}
          data-live-input
        >
          <input
            type="text"
            inputMode="numeric"
            className="input"
            value={maxInput}
            placeholder={String(boundMax)}
            aria-label={maxAriaLabel}
            onFocus={() => {
              maxFocusedRef.current = true;
            }}
            onBlur={() => {
              maxFocusedRef.current = false;
              const raw = maxInput.trim();
              if (raw === '') {
                setMaxInput('');
                emitChange(lo, boundMax);
                return;
              }
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) {
                setMaxInput(formatAxisInput(hi, boundMax));
                return;
              }
              emitChange(lo, parsed);
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setMaxInput(raw);
              if (raw.trim() === '') return;
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) return;
              emitChange(lo, parsed);
            }}
          />
          <button
            type="button"
            className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
            aria-label={`Сбросить ${maxAriaLabel.toLowerCase()}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMaxInput('');
              emitChange(lo, boundMax);
            }}
          />
        </label>
      </div>
    </div>
  );
}

export default function FilterResolutionCustomSection({
  value,
  maxBoundW,
  maxBoundH,
  onChange
}: Props) {
  const handleWidthChange = (minW: number, maxW: number) => {
    onChange({ ...value, minW, maxW });
  };

  const handleHeightChange = (minH: number, maxH: number) => {
    onChange({ ...value, minH, maxH });
  };

  return (
    <>
      <ContextMenuSeparator />
      <div
        className="context-menu__slot arc-filter-resolution-custom arc-ui-kit-scope arc-navbar-no-drag"
        data-input-size="s"
      >
        <ResolutionAxisRow
          iconClass="arc-icon-arrows-horizontal"
          boundMin={0}
          boundMax={maxBoundW}
          valueMin={value.minW}
          valueMax={value.maxW}
          minAriaLabel="Минимальная ширина"
          maxAriaLabel="Максимальная ширина"
          onChange={handleWidthChange}
        />
        <ResolutionAxisRow
          iconClass="arc-icon-arrows-vertical"
          boundMin={0}
          boundMax={maxBoundH}
          valueMin={value.minH}
          valueMax={value.maxH}
          minAriaLabel="Минимальная высота"
          maxAriaLabel="Максимальная высота"
          onChange={handleHeightChange}
        />
      </div>
    </>
  );
}
