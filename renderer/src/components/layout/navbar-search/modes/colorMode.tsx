import { COLOR_SEARCH_FORMAT_ORDER, normalizeColorHex } from '../../../../utils/colorFormats';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelColorControls from '../../SearchPanelColorControls';
import SearchPanelFullBleedSep from '../../SearchPanelFullBleedSep';
import SearchPanelSection from '../../SearchPanelSection';
import SearchPanelRecentCards from '../../SearchPanelRecentCards';
import ColorFormatInput from '../../ColorFormatInput';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function ColorBarField({ ctx }: NavbarSearchBarFieldProps) {
  const { displayColorHex, openPanel, handlePanelColorChange, colorFormat, setColorFormat } = ctx;
  const barHex =
    normalizeColorHex(displayColorHex) ?? normalizeColorHex(`#${displayColorHex}`) ?? '#F3F3F4';

  return (
    <ColorFormatInput
      embedded
      compact
      value={barHex}
      onChange={handlePanelColorChange}
      format={colorFormat}
      onFormatChange={setColorFormat}
      formats={COLOR_SEARCH_FORMAT_ORDER}
      onFocus={openPanel}
      onClick={openPanel}
      inputSize="m"
      ariaLabel="Цвет поиска"
    />
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
    selectRecentCard,
    colorFormat
  } = ctx;
  const showRecentViews = recentViewedIds.length > 0;

  return (
    <>
      <SearchPanelColorControls
        colorHex={panelColorHex}
        tolerance={panelColorTolerance}
        onColorChange={handlePanelColorChange}
        onToleranceChange={handlePanelToleranceChange}
        pantoneMode={colorFormat === 'pantone'}
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
