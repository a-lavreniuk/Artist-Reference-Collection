import { useLayoutEffect, useRef } from 'react';

import { hydrateArcNavbarIcons } from './navbarIconHydrate';



const FILTER_CHIPS = [

  { label: 'Соотношение сторон', iconClass: 'arc-icon-aspect-ratio' },

  { label: 'Тип файла', iconClass: 'arc-icon-file-type' },

  { label: 'Описание', iconClass: 'arc-icon-description' },

  { label: 'Ссылка', iconClass: 'arc-icon-link' },

  { label: 'Дата добавления', iconClass: 'arc-icon-calendar' },

  { label: 'Вес файла', iconClass: 'arc-icon-weight' },

  { label: 'Разрешение', iconClass: 'arc-icon-resolution' },

  { label: 'Длительность', iconClass: 'arc-icon-duration' }

] as const;



export default function NavbarFiltersRow() {

  const rowRef = useRef<HTMLDivElement>(null);



  useLayoutEffect(() => {

    if (rowRef.current) {

      void hydrateArcNavbarIcons(rowRef.current);

    }

  }, []);



  return (

    <div

      ref={rowRef}

      className="arc-navbar-filters-row arc-navbar-no-drag arc-ui-kit-scope"

      data-btn-size="s"

      data-elevation="default"

    >

      <button type="button" className="btn btn-outline btn-ds btn-s arc-navbar-filter-sort" disabled aria-disabled="true">

        <span className="btn-ds__icon arc-icon-sorting" aria-hidden="true" />

        <span className="btn-ds__value">Сортировка</span>

      </button>



      <div className="arc-navbar-filters-row__chips">

        {FILTER_CHIPS.map((chip) => (

          <button

            key={chip.label}

            type="button"

            className="btn btn-ghost btn-ds btn-s arc-navbar-filter-chip"

            disabled

            aria-disabled="true"

          >

            <span className={`btn-ds__icon ${chip.iconClass}`} aria-hidden="true" />

            <span className="btn-ds__value">{chip.label}</span>

          </button>

        ))}

      </div>



      <div className="btn-group btn-group-ds arc-navbar-filters-options">

        <button type="button" className="btn btn-ds btn-s btn-icon-only" disabled aria-label="Список фильтров" aria-disabled="true">

          <span className="btn-icon-only__glyph arc-icon-filter-list" aria-hidden="true" />

        </button>

        <button type="button" className="btn btn-ds btn-s btn-icon-only" disabled aria-label="Пресеты" aria-disabled="true">

          <span className="btn-icon-only__glyph arc-icon-save" aria-hidden="true" />

        </button>

        <button type="button" className="btn btn-ds btn-s btn-icon-only" disabled aria-label="Очистить фильтры" aria-disabled="true">

          <span className="btn-icon-only__glyph arc-icon-trash" aria-hidden="true" />

        </button>

      </div>

    </div>

  );

}

