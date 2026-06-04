export default function NavbarLibraryPlaceholder() {

  return (

    <button

      type="button"

      className="btn btn-outline btn-ds btn-s arc-navbar-library-btn arc-navbar-no-drag"

      disabled

      aria-label="Переключение библиотек (скоро)"

      title="Переключение библиотек — в разработке"

    >

      <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true" />

      <span className="btn-ds__value arc-navbar-library-btn__value">Вся библиотека</span>

    </button>

  );

}

