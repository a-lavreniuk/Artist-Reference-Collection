import { removeCardFilterFromParams } from '../../../../search/openCardUrl';
import NavbarSearchTagChip from '../components/NavbarSearchTagChip';
import NavbarSearchBarActions, {
  NavbarSearchIconButton
} from '../components/NavbarSearchBarActions';
import type { NavbarSearchBarFieldProps, NavbarSearchModePlugin, NavbarSearchPanelContentProps } from '../types';
import SearchPanelSection from '../../SearchPanelSection';
import SearchPanelRecentCards from '../../SearchPanelRecentCards';
import SearchPanelModeHeader from '../../SearchPanelModeHeader';
import SearchPanelFullBleedSep from '../../SearchPanelFullBleedSep';
import SearchPanelTagChip from '../../SearchPanelTagChip';
import SearchPanelCreateTagAction from '../components/SearchPanelCreateTagAction';
import { SEARCH_MODE_META } from '../../../../search/navbarSearchMode';
import { removeRecentTagId, clearAllRecentTagIds } from '../../../../search/recentSearchTags';
import { clearAllRecentViewedCardIds } from '../../../../search/recentViewedCards';

function TagsBarField({ ctx }: NavbarSearchBarFieldProps) {
  const {
    scrollFade,
    scrollTrackRef,
    searchInputRef,
    selectedTagIds,
    cardIdFilter,
    tagsIndex,
    categoryById,
    draft,
    placeholder,
    hasValue,
    openPanel,
    removeTag,
    setDraft,
    setFieldError,
    onInputKeyDown,
    onScrollTrackWheel,
    ensureInputVisible,
    resetSearchField,
    setSearchParams,
    searchParams,
    panelHadInteraction
  } = ctx;

  return (
    <>
      <div
        className="arc-navbar-search-scroll-clip"
        data-fade-start={scrollFade.start ? 'true' : undefined}
        data-fade-end={scrollFade.end ? 'true' : undefined}
      >
        <div ref={scrollTrackRef} className="arc-navbar-search-scroll" onWheel={onScrollTrackWheel}>
          <div className="arc-navbar-search-scroll__track">
            {selectedTagIds.map((id) => {
              const t = tagsIndex.get(id);
              const cat = t ? categoryById.get(t.categoryId) : undefined;
              if (!t) return null;
              return <NavbarSearchTagChip key={id} tag={t} category={cat} onRemove={() => removeTag(id)} />;
            })}
            {cardIdFilter ? (
              <span
                role="button"
                tabIndex={0}
                className="chip chip-active"
                aria-label="Сбросить фильтр по ID"
                onClick={() => {
                  panelHadInteraction.current = true;
                  setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    panelHadInteraction.current = true;
                    setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                  }
                }}
              >
                <span className="chip-color" style={{ background: 'var(--gray-300)' }} aria-hidden="true" />
                <span>ID: {cardIdFilter.slice(0, 8)}…</span>
                <span className="chip-remove" aria-hidden="true">
                  ✕
                </span>
              </span>
            ) : null}
            <input
              ref={searchInputRef}
              className="search-inner slot-value arc-navbar-search-inner"
              type="text"
              placeholder={placeholder}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setFieldError(false);
                if (e.target.value.trim().length > 0) openPanel();
              }}
              onKeyDown={onInputKeyDown}
              onFocus={() => {
                openPanel();
                ensureInputVisible();
              }}
              onClick={() => {
                openPanel();
                ensureInputVisible();
              }}
            />
          </div>
        </div>
      </div>
      <NavbarSearchBarActions>
        {hasValue ? (
          <NavbarSearchIconButton
            ariaLabel="Сбросить поиск"
            iconClass="arc-icon-close"
            className="search-multiselect-clear-btn"
            onClick={resetSearchField}
          />
        ) : (
          <NavbarSearchIconButton
            ariaLabel="Открыть поиск"
            iconClass="arc-icon-search"
            onClick={() => {
              openPanel();
              ensureInputVisible();
            }}
          />
        )}
      </NavbarSearchBarActions>
    </>
  );
}

function TagsPanelContent({ ctx }: NavbarSearchPanelContentProps) {
  const {
    q,
    searchMode,
    rankedTags,
    selectedTagIds,
    tagsIndex,
    categoryById,
    recentIds,
    recentViewedIds,
    draft,
    toggleTag,
    setRecentTick,
    selectRecentCard,
    categories,
    loadIndex
  } = ctx;

  const showRecentTags = recentIds.length > 0;
  const showRecentViews = recentViewedIds.length > 0;
  const hasRecentSectionsTags = showRecentTags || showRecentViews;

  return (
    <>
      {!q ? (
        <div className="arc-search-panel-intro">
          <SearchPanelModeHeader mode={searchMode} />
          <p className="arc-search-panel-hint">{SEARCH_MODE_META.tags.panelHint}</p>
        </div>
      ) : (
        <>
          <SearchPanelModeHeader mode={searchMode} />
          {rankedTags.length === 0 ? (
            <p className="arc-search-panel-hint arc-search-panel-hint--no-tags">
              Меток с таким именем не найдено.{' '}
              <SearchPanelCreateTagAction
                query={draft.trim()}
                categories={categories}
                onReloadIndex={loadIndex}
                onCreated={(tagId) => toggleTag(tagId)}
              />
            </p>
          ) : (
            <div className="tags-row arc-search-tags-row arc-search-panel-suggest">
              {rankedTags.map(({ tag, category }) => (
                <SearchPanelTagChip
                  key={tag.id}
                  tag={tag}
                  category={category}
                  selected={selectedTagIds.includes(tag.id)}
                  highlightQuery={q}
                  onToggle={() => toggleTag(tag.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {hasRecentSectionsTags ? <SearchPanelFullBleedSep /> : null}

      {showRecentTags ? (
        <SearchPanelSection
          title="Недавние запросы"
          onClear={() => {
            clearAllRecentTagIds();
            setRecentTick((x) => x + 1);
          }}
        >
          <div className="tags-row arc-search-tags-row">
            {recentIds.map((rid) => {
              const t = tagsIndex.get(rid);
              if (!t) return null;
              const cat = categoryById.get(t.categoryId);
              if (!cat) return null;
              return (
                <SearchPanelTagChip
                  key={rid}
                  tag={t}
                  category={cat}
                  selected={selectedTagIds.includes(rid)}
                  onToggle={() => toggleTag(rid)}
                  onRemoveFromRecent={() => {
                    removeRecentTagId(rid);
                    setRecentTick((x) => x + 1);
                  }}
                />
              );
            })}
          </div>
        </SearchPanelSection>
      ) : null}

      {showRecentViews ? (
        <>
          {showRecentTags ? <SearchPanelFullBleedSep /> : null}
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

export const tagsModePlugin: NavbarSearchModePlugin = {
  mode: 'tags',
  hasValue: (ctx) =>
    ctx.draft.trim().length > 0 || ctx.selectedTagIds.length > 0 || Boolean(ctx.cardIdFilter),
  BarField: TagsBarField,
  PanelContent: TagsPanelContent
};
