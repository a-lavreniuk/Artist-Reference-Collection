type Props = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  formatValue?: (v: number) => string;
  onChange: (min: number, max: number) => void;
  ariaLabel?: string;
};

export default function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step = 1,
  formatValue = (v) => String(v),
  onChange,
  ariaLabel = 'Диапазон'
}: Props) {
  const lo = Math.min(valueMin, valueMax);
  const hi = Math.max(valueMin, valueMax);
  const span = Math.max(max - min, step);
  const leftPct = ((lo - min) / span) * 100;
  const widthPct = ((hi - lo) / span) * 100;

  return (
    <div className="arc-range-slider" role="group" aria-label={ariaLabel}>
      <div className="arc-range-slider__track">
        <div
          className="arc-range-slider__fill"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        <input
          type="range"
          className="arc-range-slider__thumb arc-range-slider__thumb--min"
          min={min}
          max={max}
          step={step}
          value={lo}
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
          onChange={(e) => onChange(lo, Number(e.target.value))}
          aria-label={`Максимум: ${formatValue(hi)}`}
        />
      </div>
      <div className="arc-range-slider__values" aria-hidden="true">
        <span>{formatValue(lo)}</span>
        <span>{formatValue(hi)}</span>
      </div>
    </div>
  );
}
