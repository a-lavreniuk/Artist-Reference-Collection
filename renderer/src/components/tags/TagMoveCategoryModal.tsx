import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import type { CategoryRecord } from '../../services/db';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { formatSelectedTagsSubtitle } from './tagsSelectionCopy';

type Props = {
  categories: CategoryRecord[];
  selectedCount: number;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void | Promise<void>;
  onCreateCategory?: () => void;
};

export default function TagMoveCategoryModal({
  categories,
  selectedCount,
  onClose,
  onSelectCategory,
  onCreateCategory
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const visibleCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(needle));
  }, [categories, query]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [visibleCategories, pickedId, query, onCreateCategory]);

  const submit = async () => {
    if (!pickedId || isMoving) return;
    setIsMoving(true);
    try {
      await onSelectCategory(pickedId);
    } finally {
      setIsMoving(false);
    }
  };

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
            <div className="arc-modal__title-block">
              <h3 className="arc-modal__title" id="arcTagMoveCategoryTitle">
                Переместить в категорию
              </h3>
              <p className="arc-modal__subtitle">{formatSelectedTagsSubtitle(selectedCount)}</p>
            </div>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <div className={`field field-full search-live${query ? ' has-value' : ''}`}>
                <div className="input search-field input-slots">
                  <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    className="search-inner slot-value"
                    placeholder="Поиск по категориям"
                    value={query}
                    autoFocus
                    aria-label="Поиск по категориям"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      void submit();
                    }}
                  />
                  <button
                    type="button"
                    className="input-inline-icon search-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
                    aria-label="Очистить"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                  />
                </div>
              </div>
            </div>

            {visibleCategories.length > 0 ? (
              <div className="arc-tag-move-list">
                <div className="arc-tag-move-list__pad">
                  {visibleCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`dropdown-row${category.id === pickedId ? ' is-checked' : ''}`}
                      aria-pressed={category.id === pickedId}
                      onClick={() => setPickedId(category.id)}
                    >
                      <span className="arc-tag-move-row__label">
                        <span
                          className="chip-color"
                          style={{ background: category.colorHex }}
                          aria-hidden="true"
                        />
                        <span className="arc-tag-move-row__name">{category.name}</span>
                      </span>
                      <span
                        className="dropdown-row-check tab-icon arc-icon-check"
                        data-arc-icon-size="s"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="arc-modal__slot">
                <p className="text-s arc-tag-move-empty">Категории не найдены</p>
              </div>
            )}

          </div>

          <footer
            className={`arc-modal__footer ${
              onCreateCategory ? 'arc-modal__footer--actions-3' : 'arc-modal__footer--actions-2'
            }`}
          >
            {onCreateCategory ? (
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onCreateCategory}>
                <span className="btn-ds__value">Новая категория</span>
              </button>
            ) : null}
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                disabled={!pickedId || isMoving}
                onClick={() => void submit()}
              >
                <span className="btn-ds__value">Перенести</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
