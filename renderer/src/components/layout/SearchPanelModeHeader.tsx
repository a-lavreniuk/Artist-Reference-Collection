import { SEARCH_MODE_META, type NavbarSearchMode } from '../../search/navbarSearchMode';



type SearchPanelModeHeaderProps = {

  mode: NavbarSearchMode;

};



/** Заголовок активного режима в Search Menu (Figma 889-9667, Heading/S = h3). */

export default function SearchPanelModeHeader({ mode }: SearchPanelModeHeaderProps) {

  const meta = SEARCH_MODE_META[mode];

  return <h3 className="h3 arc-search-panel-mode-header__title">{meta.panelTitle}</h3>;

}


