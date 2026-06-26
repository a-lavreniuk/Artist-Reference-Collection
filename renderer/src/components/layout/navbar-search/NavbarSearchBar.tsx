import { useNavbarSearch } from './NavbarSearchContext';
import NavbarSearchModes from './NavbarSearchModes';
import { NAVBAR_SEARCH_MODES } from './modes/registry';
import { getLongestSearchPlaceholder } from '../../../search/navbarSearchMode';

export default function NavbarSearchBar() {
  const ctx = useNavbarSearch();
  const plugin = NAVBAR_SEARCH_MODES[ctx.searchMode];
  const BarField = plugin.BarField;
  const isTagsMode = ctx.searchMode === 'tags';

  return (
    <>
      <span ref={ctx.measureRef} className="arc-navbar-measure-placeholder typo-p-m" aria-hidden="true">
        {getLongestSearchPlaceholder()}
      </span>
      <div className="arc-navbar-search-anchor" ref={ctx.searchAnchorRef}>
        <div className="arc-navbar-search-row">
          <NavbarSearchModes
            mode={ctx.searchMode}
            aiSearchEnabled={ctx.aiNavbarModesVisible}
            onModeChange={ctx.handleModeChange}
          />
          <div
            className={`field field-full arc-navbar-search-field arc-navbar-search-live${isTagsMode ? ' search-multiselect-live' : ''}${ctx.hasValue ? ' has-value' : ''}${ctx.fieldError ? ' field-error' : ''}`}
            data-live-search-multi={isTagsMode ? '' : undefined}
          >
            <div
              className={`input input--size-m input-slots arc-navbar-search${
                isTagsMode
                  ? ' search-multiselect'
                  : ctx.searchMode === 'color'
                    ? ' arc-navbar-search--color'
                    : ctx.searchMode === 'similar'
                      ? ' arc-navbar-search--similar'
                      : ' arc-navbar-search--ai'
              }`}
            >
              <BarField ctx={ctx} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
