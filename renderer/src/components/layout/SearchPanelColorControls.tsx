import ModalCategoryColorPicker from './ModalCategoryColorPicker';
import PantoneNearestMatches from './PantoneNearestMatches';
import SearchPanelModeHeader from './SearchPanelModeHeader';
import ValueSlider from '../range-slider/ValueSlider';
import { COLOR_SEARCH_PRESETS } from '../../search/colorPresets';
import { SEARCH_MODE_META } from '../../search/navbarSearchMode';
import { normalizeHex } from '../../utils/colorPicker';

type SearchPanelColorControlsProps = {
  colorHex: string;
  tolerance: number;
  onColorChange: (hex: string) => void;
  onToleranceChange: (value: number) => void;
  /** Режим Pantone: под палитрой показываются ближайшие совпадения. */
  pantoneMode?: boolean;
};

function clampTolerance(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Палитра и точность в Search Menu (Figma 891-18501). */
export default function SearchPanelColorControls({
  colorHex,
  tolerance,
  onColorChange,
  onToleranceChange,
  pantoneMode = false
}: SearchPanelColorControlsProps) {
  const safeHex = normalizeHex(colorHex) ?? COLOR_SEARCH_PRESETS[1].hex;
  const activePresetId = COLOR_SEARCH_PRESETS.find((p) => p.hex.toUpperCase() === safeHex.toUpperCase())?.id;

  const onToleranceInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) {
      onToleranceChange(0);
      return;
    }
    const n = Number.parseInt(digits, 10);
    if (!Number.isFinite(n)) return;
    onToleranceChange(clampTolerance(n));
  };

  return (
    <div className="arc-search-panel-color">
      <div className="arc-search-panel-color-intro">
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
        <p className="text-m arc-search-panel-hint">{SEARCH_MODE_META.color.panelHint}</p>
      </div>

      <div className="arc-search-panel-color-picker">
        <ModalCategoryColorPicker value={safeHex} onChange={onColorChange} variant="paletteOnly" />
      </div>

      {pantoneMode ? <PantoneNearestMatches colorHex={safeHex} onSelect={onColorChange} /> : null}

      <div className="arc-search-panel-color-tolerance-row">
        <p className="text-m arc-search-panel-color-tolerance-row__label">Точность</p>
        <div className="arc-search-panel-color-tolerance-row__slider arc-navbar-no-drag">
          <ValueSlider
            size="s"
            min={0}
            max={100}
            step={1}
            value={tolerance}
            showValue={false}
            formatValue={(v) => `${v}%`}
            onChange={(value) => onToleranceChange(clampTolerance(value))}
            ariaLabel="Точность цветового поиска"
          />
        </div>
        <div
          className="input input-slots arc-search-panel-color-tolerance-input arc-ui-kit-scope"
          data-input-size="s"
        >
          <input
            type="text"
            inputMode="numeric"
            className="slot-value arc-search-panel-color-tolerance-input__value"
            value={String(tolerance)}
            onChange={(e) => onToleranceInput(e.target.value)}
            aria-label="Точность в процентах"
          />
          <span className="text-s slot-trailing arc-search-panel-color-tolerance-input__suffix" aria-hidden="true">
            %
          </span>
        </div>
      </div>
    </div>
  );
}
