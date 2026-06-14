import { useCallback, useEffect, useRef, useState } from 'react';

import type { RangeSliderSize } from './RangeSlider';
import { snapToStep, valueFromClientX } from './rangeSliderMath';

type Props = {
  min: number;
  max: number;
  value: number;
  step?: number;
  size?: RangeSliderSize;
  formatValue?: (v: number) => string;
  onChange: (value: number) => void;
  ariaLabel?: string;
  showValue?: boolean;
  className?: string;
  disabled?: boolean;
};

export default function ValueSlider({
  min,
  max,
  value,
  step = 1,
  size = 's',
  formatValue = (v) => String(v),
  onChange,
  ariaLabel = 'Значение',
  showValue = true,
  className,
  disabled = false
}: Props) {
  const current = snapToStep(value, min, max, step);
  const span = Math.max(max - min, step);
  const widthPct = ((current - min) / span) * 100;

  const rootClass = ['arc-range-slider', className].filter(Boolean).join(' ');
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const readValueFromClientX = useCallback(
    (clientX: number) =>
      valueFromClientX(clientX, trackRef.current?.getBoundingClientRect(), min, max, step),
    [max, min, step]
  );

  useEffect(() => {
    if (!active) return;
    const clear = () => setActive(false);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [active]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.classList.contains('arc-range-slider__thumb')) return;
    onChange(readValueFromClientX(e.clientX));
  };

  return (
    <div
      className={rootClass}
      data-range-slider-size={size}
      data-range-slider-variant="single"
      data-active-thumb={active ? 'value' : undefined}
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
            style={{ left: 0, width: `${widthPct}%` }}
          >
            <span className="arc-range-slider__pin arc-range-slider__pin--max" aria-hidden="true" />
          </div>
          <input
            type="range"
            className="arc-range-slider__thumb arc-range-slider__thumb--value"
            min={min}
            max={max}
            step={step}
            value={current}
            disabled={disabled}
            onPointerDown={() => setActive(true)}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`${ariaLabel}: ${formatValue(current)}`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current}
          />
        </div>
      </div>
      {showValue ? (
        <div className="arc-range-slider__values arc-range-slider__values--single" aria-hidden="true">
          <span>{formatValue(current)}</span>
        </div>
      ) : null}
    </div>
  );
}
