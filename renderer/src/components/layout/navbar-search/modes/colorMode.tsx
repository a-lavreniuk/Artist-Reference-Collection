import { useEffect, useState } from 'react';
import { normalizeHex } from '../../../../utils/colorPicker';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelColorControls from '../../SearchPanelColorControls';
import SearchPanelFullBleedSep from '../../SearchPanelFullBleedSep';
import SearchPanelSection from '../../SearchPanelSection';
import SearchPanelRecentCards from '../../SearchPanelRecentCards';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function ColorBarField({ ctx }: NavbarSearchBarFieldProps) {
  const { displayColorHex, openPanel, handlePanelColorChange } = ctx;
  const [hexDraft, setHexDraft] = useState(displayColorHex);

  useEffect(() => {
    setHexDraft(displayColorHex);
  }, [displayColorHex]);

  const swatchHex =
    normalizeHex(hexDraft) ?? normalizeHex(displayColorHex) ?? `#${displayColorHex.replace(/^#/, '')}`;

  const commitHexDraft = (raw: string) => {
    const parsed = normalizeHex(raw);
    if (!parsed) {
      setHexDraft(displayColorHex);
      return;
    }
    setHexDraft(parsed.replace(/^#/, ''));
    handlePanelColorChange(parsed);
  };

  return (
    <>
      <span className="color-prepend slot-prepend">HEX</span>
      <input
        className="color-value-input slot-value"
        type="text"
        value={hexDraft}
        onChange={(e) => {
          const next = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
          setHexDraft(next);
          const parsed = normalizeHex(next);
          if (parsed) handlePanelColorChange(parsed);
        }}
        onBlur={() => commitHexDraft(hexDraft)}
        onFocus={() => openPanel()}
        onClick={() => openPanel()}
        aria-label="HEX цвета"
        spellCheck={false}
      />
      <span
        className="color-swatch-inline slot-trailing"
        style={{ background: swatchHex }}
        aria-hidden="true"
      />
    </>
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
