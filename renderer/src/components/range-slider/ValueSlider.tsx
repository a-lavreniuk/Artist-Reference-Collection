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
  /** false — клик по дорожке обрабатывает родитель (например таймлайн видео). */
  seekOnTrackPointerDown?: boolean;
  /** Hover по дорожке без нажатия (например превью на таймлайне). */
  onTrackPointerMove?: (clientX: number) => void;
  onTrackPointerLeave?: () => void;
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
  disabled = false,
  seekOnTrackPointerDown = true,
  onTrackPointerMove,
  onTrackPointerLeave
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
    if (disabled || !seekOnTrackPointerDown) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    onChange(readValueFromClientX(e.clientX));
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (seekOnTrackPointerDown && e.currentTarget.hasPointerCapture(e.pointerId)) {
      onChange(readValueFromClientX(e.clientX));
      return;
    }
    if (!onTrackPointerMove || e.buttons !== 0) return;
    onTrackPointerMove(e.clientX);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekOnTrackPointerDown || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onChange(readValueFromClientX(e.clientX));
    e.currentTarget.releasePointerCapture(e.pointerId);
    setActive(false);
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
          onPointerDownCapture={seekOnTrackPointerDown ? handleTrackPointerDown : undefined}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          onPointerLeave={() => onTrackPointerLeave?.()}
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
