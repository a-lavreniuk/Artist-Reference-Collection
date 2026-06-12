import { useState } from 'react';
import RangeSlider from '../components/range-slider/RangeSlider';

export default function UiKitRangeSliderDemo() {
  const [rangeS, setRangeS] = useState({ min: 0, max: 50 });
  const [rangeM, setRangeM] = useState({ min: 10, max: 80 });

  return (
    <div className="inputs-column">
      <label className="field">
        <span className="label">Size S (фильтры)</span>
        <RangeSlider
          size="s"
          min={0}
          max={100}
          step={1}
          valueMin={rangeS.min}
          valueMax={rangeS.max}
          showValues={false}
          onChange={(min, max) => setRangeS({ min, max })}
          ariaLabel="Диапазон, размер S"
        />
        <span className="text-s" style={{ marginTop: 'var(--s-1)', color: 'var(--typo-tone-secondary)' }}>
          {rangeS.min} – {rangeS.max}
        </span>
      </label>
      <label className="field">
        <span className="label">Size M</span>
        <RangeSlider
          size="m"
          min={0}
          max={100}
          step={1}
          valueMin={rangeM.min}
          valueMax={rangeM.max}
          onChange={(min, max) => setRangeM({ min, max })}
          ariaLabel="Диапазон, размер M"
        />
      </label>
      <label className="field">
        <span className="label">Disabled</span>
        <RangeSlider
          size="s"
          min={0}
          max={100}
          step={1}
          valueMin={20}
          valueMax={60}
          disabled
          showValues={false}
          onChange={() => {}}
          ariaLabel="Диапазон, недоступен"
        />
      </label>
    </div>
  );
}
