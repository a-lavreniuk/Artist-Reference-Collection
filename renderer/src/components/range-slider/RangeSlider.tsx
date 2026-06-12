import { useCallback, useEffect, useRef, useState } from 'react';

export type RangeSliderSize = 's' | 'm' | 'l';

type Props = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  size?: RangeSliderSize;
  formatValue?: (v: number) => string;
  onChange: (min: number, max: number) => void;
  ariaLabel?: string;
  showValues?: boolean;
  className?: string;
  disabled?: boolean;
};

export default function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step = 1,
  size = 's',
  formatValue = (v) => String(v),
  onChange,
  ariaLabel = 'Диапазон',
  showValues = true,
  className,
  disabled = false
}: Props) {
  const lo = Math.min(valueMin, valueMax);
  const hi = Math.max(valueMin, valueMax);
  const span = Math.max(max - min, step);
  const leftPct = ((lo - min) / span) * 100;
  const widthPct = ((hi - lo) / span) * 100;

  const rootClass = ['arc-range-slider', className].filter(Boolean).join(' ');
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);

  const snapToStep = useCallback(
    (value: number) => {
      const steps = Math.round((value - min) / step);
      return Math.max(min, Math.min(max, min + steps * step));
    },
    [max, min, step]
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return min;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snapToStep(min + ratio * span);
    },
    [min, snapToStep, span]
  );

  useEffect(() => {
    if (!activeThumb) return;
    const clear = () => setActiveThumb(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [activeThumb]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.classList.contains('arc-range-slider__thumb')) return;

    const clickValue = valueFromClientX(e.clientX);
    const distMin = Math.abs(clickValue - lo);
    const distMax = Math.abs(clickValue - hi);

    if (distMin <= distMax) {
      onChange(Math.min(clickValue, hi), hi);
    } else {
      onChange(lo, Math.max(clickValue, lo));
    }
  };

  return (
    <div
      className={rootClass}
      data-range-slider-size={size}
      data-active-thumb={activeThumb ?? undefined}
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      <div className="arc-range-slider__shell">
        <div
          className="arc-range-slider__track"
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
        >
          <div
            className="arc-range-slider__fill"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            <span className="arc-range-slider__pin arc-range-slider__pin--min" aria-hidden="true" />
            <span className="arc-range-slider__pin arc-range-slider__pin--max" aria-hidden="true" />
          </div>
          <input
            type="range"
            className="arc-range-slider__thumb arc-range-slider__thumb--min"
            min={min}
            max={max}
            step={step}
            value={lo}
            disabled={disabled}
            onPointerDown={() => setActiveThumb('min')}
            onChange={(e) => onChange(Number(e.target.value), hi)}
            aria-label={`Минимум: ${formatValue(lo)}`}
          />
          <input
            type="range"
            className="arc-range-slider__thumb arc-range-slider__thumb--max"
            min={min}
            max={max}
            step={step}
            value={hi}
            disabled={disabled}
            onPointerDown={() => setActiveThumb('max')}
            onChange={(e) => onChange(lo, Number(e.target.value))}
            aria-label={`Максимум: ${formatValue(hi)}`}
          />
        </div>
      </div>
      {showValues ? (
        <div className="arc-range-slider__values" aria-hidden="true">
          <span>{formatValue(lo)}</span>
          <span>{formatValue(hi)}</span>
        </div>
      ) : null}
    </div>
  );
}
