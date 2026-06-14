import { Tooltip } from '../tooltip/Tooltip';
import {
  SEARCH_MODE_META,
  type NavbarSearchMode,
  writeNavbarSearchMode
} from '../../search/navbarSearchMode';

type NavbarSearchModesProps = {
  mode: NavbarSearchMode;
  aiSearchEnabled: boolean;
  onModeChange: (mode: NavbarSearchMode) => void;
};

const MODES: NavbarSearchMode[] = ['tags', 'ai', 'color', 'similar'];

/** Figma 60:5582 — переключатель режимов поиска */
export default function NavbarSearchModes({ mode, aiSearchEnabled, onModeChange }: NavbarSearchModesProps) {
  const visibleModes = MODES.filter((item) => item !== 'ai' || aiSearchEnabled);

  return (
    <div className="arc-navbar-search-modes" role="tablist" aria-label="Режим поиска">
      {visibleModes.map((item) => {
        const meta = SEARCH_MODE_META[item];
        const active = mode === item;
        const button = (
          <button
            type="button"
            role="tab"
            className={`arc-navbar-search-mode${active ? ' is-active' : ''}`}
            aria-selected={active}
            aria-label={meta.label}
            disabled={!meta.enabled}
            onClick={() => {
              if (!meta.enabled) return;
              writeNavbarSearchMode(item);
              onModeChange(item);
            }}
          >
            <span className={`arc-navbar-search-mode__icon ${meta.iconClass}`} aria-hidden="true" />
          </button>
        );

        if (!meta.enabled) {
          return (
            <Tooltip key={item} content={`${meta.label} — в разработке`} delay={500} position="bottom">
              <span className="arc-tooltip-anchor-inline">{button}</span>
            </Tooltip>
          );
        }

        return (
          <Tooltip key={item} content={meta.label} delay={500} position="bottom">
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}
