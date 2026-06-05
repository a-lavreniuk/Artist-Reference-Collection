import { Tooltip } from '../tooltip/Tooltip';

export default function NavbarLibraryPlaceholder() {
  return (
    <Tooltip content="Переключение библиотек — в разработке" delay={500} position="top">
      <span className="arc-tooltip-anchor-inline">
        <button
          type="button"
          className="btn btn-outline btn-ds btn-s arc-navbar-library-btn arc-navbar-no-drag"
          disabled
          aria-label="Переключение библиотек (скоро)"
        >
          <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true" />
          <span className="btn-ds__value arc-navbar-library-btn__value">Вся библиотека</span>
        </button>
      </span>
    </Tooltip>
  );
}
