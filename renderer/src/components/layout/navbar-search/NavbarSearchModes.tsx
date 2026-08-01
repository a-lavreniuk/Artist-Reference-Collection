import { SEARCH_MODE_META, type NavbarSearchMode } from '../../../search/navbarSearchMode';

type NavbarSearchModesProps = {
  mode: NavbarSearchMode;
  aiSearchEnabled: boolean;
  onModeChange: (mode: NavbarSearchMode) => void;
};

const MODES: NavbarSearchMode[] = ['tags', 'ai', 'color', 'similar'];

/** Figma 822:8875 — icon-tab M, без групповой рамки */
export default function NavbarSearchModes({ mode, aiSearchEnabled, onModeChange }: NavbarSearchModesProps) {
  const visibleModes = MODES.filter((item) => {
    if (item === 'ai' || item === 'similar') return aiSearchEnabled;
    return true;
  });

  return (
    <div className="tabs arc-navbar-search-modes" role="tablist" aria-label="Режим поиска">
      {visibleModes.map((item) => {
        const meta = SEARCH_MODE_META[item];
        const active = mode === item;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            className={`tab-button tab-icon-only${active ? ' is-active' : ''}`}
            aria-selected={active}
            aria-label={meta.enabled ? meta.label : `${meta.label} — в разработке`}
            disabled={!meta.enabled}
            onClick={() => {
              if (!meta.enabled) return;
              // Режим и URL обновляет handleModeChange; не вызываем writeNavbarSearchMode
              // заранее — иначе эффект sync по URL может откатить клик (особенно из «Цвет»).
              onModeChange(item);
            }}
          >
            <span className={`tab-icon ${meta.iconClass}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
