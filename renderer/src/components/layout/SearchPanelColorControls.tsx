import ModalCategoryColorPicker from './ModalCategoryColorPicker';
import SearchPanelModeHeader from './SearchPanelModeHeader';
import ValueSlider from '../range-slider/ValueSlider';
import { COLOR_SEARCH_PRESETS } from '../../search/colorPresets';
import { normalizeHex } from '../../utils/colorPicker';

type SearchPanelColorControlsProps = {
  colorHex: string;
  tolerance: number;
  onColorChange: (hex: string) => void;
  onToleranceChange: (value: number) => void;
};

/** Палитра и точность в Search Menu (Figma 891-18501). */
export default function SearchPanelColorControls({
  colorHex,
  tolerance,
  onColorChange,
  onToleranceChange
}: SearchPanelColorControlsProps) {
  const safeHex = normalizeHex(colorHex) ?? COLOR_SEARCH_PRESETS[1].hex;
  const activePresetId = COLOR_SEARCH_PRESETS.find((p) => p.hex.toUpperCase() === safeHex.toUpperCase())?.id;

  return (
    <div className="arc-search-panel-color">
      <div className="arc-search-panel-color-header">
        <SearchPanelModeHeader mode="color" />
        <div className="arc-search-panel-color-presets" role="list" aria-label="Быстрые цвета">
          {COLOR_SEARCH_PRESETS.map((preset) => {
            const active = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                role="listitem"
                className={`arc-search-panel-color-preset${active ? ' is-active' : ''}`}
                style={{ background: preset.hex }}
                aria-label={preset.label}
                aria-pressed={active}
                onClick={() => onColorChange(preset.hex)}
              />
            );
          })}
        </div>
      </div>

      <div className="arc-search-panel-color-picker">
        <ModalCategoryColorPicker value={safeHex} onChange={onColorChange} />
      </div>

      <div className="arc-search-panel-color-tolerance">
        <div className="arc-search-panel-color-tolerance__head">
          <span className="text-m arc-search-panel-color-tolerance__label">Точность</span>
          <span className="text-m arc-search-panel-color-tolerance__value" aria-hidden="true">
            {tolerance}%
          </span>
        </div>
        <ValueSlider
          size="s"
          min={0}
          max={100}
          step={1}
          value={tolerance}
          showValue={false}
          formatValue={(v) => `${v}%`}
          onChange={onToleranceChange}
          ariaLabel="Точность цветового поиска"
        />
      </div>
    </div>
  );
}
