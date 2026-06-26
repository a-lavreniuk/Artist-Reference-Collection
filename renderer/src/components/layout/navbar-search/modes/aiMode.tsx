import NavbarSearchBarActions, {
  NavbarSearchIconButton,
  NavbarSearchLoader
} from '../components/NavbarSearchBarActions';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelSection from '../../SearchPanelSection';
import SearchPanelModeHeader from '../../SearchPanelModeHeader';
import SearchPanelFullBleedSep from '../../SearchPanelFullBleedSep';
import SearchPanelRecentQueries from '../../SearchPanelRecentQueries';
import SearchPanelRecentCards from '../../SearchPanelRecentCards';
import { SEARCH_MODE_META } from '../../../../search/navbarSearchMode';
import { clearAllRecentAiQueries } from '../../../../search/recentSearchAi';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function AiBarField({ ctx }: NavbarSearchBarFieldProps) {
  const {
    searchInputRef,
    draft,
    placeholder,
    aiSearching,
    showAiClearDraft,
    showAiClearResult,
    clearAiDraft,
    clearAiSearch,
    showAiSend,
    openPanel,
    applyAiQuery,
    setDraft,
    setFieldError,
    onInputKeyDown
  } = ctx;

  return (
    <>
      <input
        ref={searchInputRef}
        className="search-inner slot-value arc-navbar-search-inner-ai"
        type="text"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setFieldError(false);
          if (e.target.value.trim().length > 0) openPanel();
        }}
        onKeyDown={onInputKeyDown}
        onFocus={() => openPanel()}
        onClick={() => openPanel()}
      />
      <NavbarSearchBarActions>
        {aiSearching ? (
          <NavbarSearchLoader />
        ) : (
          <>
            {showAiClearDraft ? (
              <NavbarSearchIconButton
                ariaLabel="Сбросить ввод"
                iconClass="arc-icon-close"
                className="arc-navbar-search-clear-btn"
                onClick={clearAiDraft}
              />
            ) : showAiClearResult ? (
              <NavbarSearchIconButton
                ariaLabel="Сбросить поиск"
                iconClass="arc-icon-close"
                className="arc-navbar-search-clear-btn"
                onClick={clearAiSearch}
              />
            ) : null}
            {showAiSend ? (
              <NavbarSearchIconButton
                ariaLabel="Запустить поиск"
                iconClass="arc-icon-send"
                className="arc-navbar-search-send-btn"
                onClick={() => applyAiQuery(draft)}
              />
            ) : (
              <NavbarSearchIconButton
                ariaLabel="Открыть поиск"
                iconClass="arc-icon-search"
                className="arc-navbar-search-send-btn"
                onClick={() => openPanel()}
              />
            )}
          </>
        )}
      </NavbarSearchBarActions>
    </>
  );
}

function AiPanelContent({ ctx }: NavbarSearchPanelContentProps) {
  const { recentAiIds, recentViewedIds, setRecentTick, selectRecentAiQuery, reuseRecentAiQuery, selectRecentCard } = ctx;
  const showRecentAi = recentAiIds.length > 0;
  const showRecentViews = recentViewedIds.length > 0;
  const hasRecentSectionsAi = showRecentAi || showRecentViews;

  return (
    <>
      <div className="arc-search-panel-intro arc-search-panel-intro--ai">
        <SearchPanelModeHeader mode="ai" />
        <p className="arc-search-panel-hint">{SEARCH_MODE_META.ai.panelHint}</p>
      </div>

      {hasRecentSectionsAi ? <SearchPanelFullBleedSep /> : null}

      {showRecentAi ? (
        <SearchPanelSection
          title="Недавние запросы"
          onClear={() => {
            clearAllRecentAiQueries();
            setRecentTick((x) => x + 1);
          }}
        >
          <SearchPanelRecentQueries
            queries={recentAiIds}
            onSelect={selectRecentAiQuery}
            onReuse={reuseRecentAiQuery}
          />
        </SearchPanelSection>
      ) : null}

      {showRecentViews ? (
        <>
          {showRecentAi ? <SearchPanelFullBleedSep /> : null}
          <SearchPanelSection
            title="Недавние просмотры"
            onClear={() => {
              clearAllRecentViewedCardIds();
              setRecentTick((x) => x + 1);
            }}
          >
            <SearchPanelRecentCards cardIds={recentViewedIds} onSelect={selectRecentCard} />
          </SearchPanelSection>
        </>
      ) : null}
    </>
  );
}

export const aiModePlugin: NavbarSearchModePlugin = {
  mode: 'ai',
  hasValue: (ctx) => ctx.draft.trim().length > 0 || Boolean(ctx.aiQuery),
  BarField: AiBarField,
  PanelContent: AiPanelContent
};
