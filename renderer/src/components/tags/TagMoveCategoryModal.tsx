import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import type { CategoryRecord } from '../../services/db';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  categories: CategoryRecord[];
  selectedCount: number;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void | Promise<void>;
};

export default function TagMoveCategoryModal({
  categories,
  selectedCount,
  onClose,
  onSelectCategory
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [categories.length, selectedCount]);

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="tag-move-category-modal"
          className="arc-modal arc-ui-kit-scope"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcTagMoveCategoryTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcTagMoveCategoryTitle">
              Переместить в категорию
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">Выбрано меток: {selectedCount}</p>
            </div>
            <div className="arc-modal__slot context-menu context-menu--static">
              <div className="context-menu__list" role="menu">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="menuitem"
                    className="context-menu__item"
                    onClick={() => void onSelectCategory(category.id)}
                  >
                    <span className="context-menu__item-inner">
                      <span
                        className="chip-color"
                        style={{ background: category.colorHex }}
                        aria-hidden="true"
                      />
                      <span className="context-menu__item-label-cluster">
                        <span className="context-menu__item-label">{category.name}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
