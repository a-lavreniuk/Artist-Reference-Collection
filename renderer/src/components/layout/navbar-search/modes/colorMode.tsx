import { normalizeHex } from '../../../../utils/colorPicker';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelColorControls from '../../SearchPanelColorControls';
import SearchPanelFullBleedSep from '../../SearchPanelFullBleedSep';
import SearchPanelSection from '../../SearchPanelSection';
import SearchPanelRecentCards from '../../SearchPanelRecentCards';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function ColorBarField({ ctx }: NavbarSearchBarFieldProps) {
  const { displayColorHex, openPanel, handlePanelColorChange } = ctx;
  const swatchHex = normalizeHex(displayColorHex) ?? `#${displayColorHex.replace(/^#/, '')}`;

  return (
    <div className="arc-navbar-search-color-trigger slot-value">
      <span className="arc-navbar-search-color-hex-prefix">HEX</span>
      <input
        className="arc-navbar-search-color-hex-input"
        type="text"
        value={displayColorHex}
        onChange={(e) => {
          const parsed = normalizeHex(e.target.value);
          if (parsed) handlePanelColorChange(parsed);
        }}
        onFocus={() => openPanel()}
        onClick={() => openPanel()}
        aria-label="HEX цвета"
        spellCheck={false}
      />
      <span
        className="arc-navbar-search-color-swatch"
        style={{ background: swatchHex }}
        aria-hidden="true"
      />
    </div>
  );
}

function ColorPanelContent({ ctx }: NavbarSearchPanelContentProps) {
  const {
    panelColorHex,
    panelColorTolerance,
    handlePanelColorChange,
    handlePanelToleranceChange,
    recentViewedIds,
    setRecentTick,
    selectRecentCard
  } = ctx;
  const showRecentViews = recentViewedIds.length > 0;

  return (
    <>
      <SearchPanelColorControls
        colorHex={panelColorHex}
        tolerance={panelColorTolerance}
        onColorChange={handlePanelColorChange}
        onToleranceChange={handlePanelToleranceChange}
      />

      {showRecentViews ? <SearchPanelFullBleedSep /> : null}

      {showRecentViews ? (
        <SearchPanelSection
          title="Недавние просмотры"
          onClear={() => {
            clearAllRecentViewedCardIds();
            setRecentTick((x) => x + 1);
          }}
        >
          <SearchPanelRecentCards cardIds={recentViewedIds} onSelect={selectRecentCard} />
        </SearchPanelSection>
      ) : null}
    </>
  );
}

export const colorModePlugin: NavbarSearchModePlugin = {
  mode: 'color',
  hasValue: (ctx) => Boolean(ctx.colorHex),
  BarField: ColorBarField,
  PanelContent: ColorPanelContent
};
