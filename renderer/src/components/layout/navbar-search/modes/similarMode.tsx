import NavbarSearchBarActions, {
  NavbarSearchIconButton,
  NavbarSearchLoader
} from '../components/NavbarSearchBarActions';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelSimilarControls from '../../SearchPanelSimilarControls';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function SimilarBarField({ ctx }: NavbarSearchBarFieldProps) {
  const { similarSearch, placeholder, openPanel, resetSearchField } = ctx;

  return (
    <>
      <button
        type="button"
        className="arc-navbar-search-similar-trigger slot-value"
        aria-label="Открыть поиск по совпадениям"
        onClick={() => openPanel()}
      >
        {similarSearch.previewSrc ? (
          <img src={similarSearch.previewSrc} alt="" className="arc-navbar-search-similar-thumb" />
        ) : (
          <span className="arc-navbar-search-similar-placeholder">{placeholder}</span>
        )}
      </button>
      <NavbarSearchBarActions>
        {similarSearch.similarSearching ? (
          <NavbarSearchLoader />
        ) : (
          <>
            {similarSearch.hasSimilarQuery ? (
              <NavbarSearchIconButton
                ariaLabel="Сбросить поиск"
                iconClass="arc-icon-close"
                className="arc-navbar-search-clear-btn"
                onClick={resetSearchField}
              />
            ) : null}
            <NavbarSearchIconButton
              ariaLabel="Открыть поиск по совпадениям"
              iconClass="arc-icon-search"
              className="arc-navbar-search-send-btn"
              onClick={() => openPanel()}
            />
          </>
        )}
      </NavbarSearchBarActions>
    </>
  );
}

function SimilarPanelContent({ ctx }: NavbarSearchPanelContentProps) {
  const { similarSearch, recentViewedIds, setRecentTick, panelHadInteraction } = ctx;

  return (
    <SearchPanelSimilarControls
      crop={similarSearch.panelCrop}
      hasQuery={similarSearch.hasSimilarQuery}
      previewSrc={similarSearch.previewSrc}
      onCropChange={similarSearch.onPanelCropChange}
      onUploadStaged={similarSearch.setSimilarUploadQuery}
      onClearQuery={similarSearch.clearSimilarQuery}
      onRecentClear={() => {
        clearAllRecentViewedCardIds();
        setRecentTick((x) => x + 1);
      }}
      recentViewedIds={recentViewedIds}
      onSelectRecentCard={(id) => {
        panelHadInteraction.current = true;
        similarSearch.setSimilarCardQuery(id);
      }}
    />
  );
}

export const similarModePlugin: NavbarSearchModePlugin = {
  mode: 'similar',
  hasValue: (ctx) => ctx.similarSearch.hasSimilarQuery,
  BarField: SimilarBarField,
  PanelContent: SimilarPanelContent
};
