import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArcAnimatedModalHost } from '../../motion';
import { useFloatingPanelGeometry } from '../../hooks/useFloatingPanelGeometry';
import { ContextMenuSeparator } from '../context-menu';
import TagChipToggleWithTooltip from '../tags/TagChipToggleWithTooltip';
import CategorySettingsModal, {
  type CategorySettingsModalState
} from '../tags/CategorySettingsModal';
import TagSettingsModal, { type TagSettingsModalState } from '../tags/TagSettingsModal';
import { Tooltip } from '../tooltip/Tooltip';
import { TruncatedTextWithTooltip } from '../tooltip/TruncatedTextWithTooltip';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  addCategory,
  addTag,
  deleteTag,
  getAllCategories,
  getTagsByCategory,
  updateTag,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import {
  buildTagPickerGroups,
  filterSidebarCategories,
  normalizeSearchQuery
} from './tagPickerFilter';

const TAGS_PICKER_PANEL_ID = 'card-detail-tags-picker';
const TAGS_PICKER_MIN_WIDTH = 690;
const TAGS_PICKER_MIN_HEIGHT = 400;
const TAGS_PICKER_MOVE_ALLOW = [
  '.arc-add-tags-picker__sidebar-head',
  '.arc-add-tags-picker__sidebar-foot',
  '.arc-add-tags-picker__content-fixed'
];
const TAGS_PICKER_SCROLL_BLOCK = [
  '.arc-add-tags-picker__tags-scroll',
  '.arc-add-tags-picker__sidebar-scroll'
];

type Props = {
  selectedTagIds: string[];
  onClose: () => void;
  onToggleTag: (tagId: string) => void | Promise<void>;
};

function PickerCategoryItem({
  label,
  active,
  onSelect
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item${active ? ' is-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="context-menu__item-inner">
        <span className="context-menu__item-label-cluster">
          <TruncatedTextWithTooltip text={label} className="context-menu__item-label" />
        </span>
      </span>
    </button>
  );
}

export default function CardDetailTagsModal({ selectedTagIds, onClose, onToggleTag }: Props) {
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const {
    panelRef,
    style: panelStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave
  } = useFloatingPanelGeometry({
    panelId: TAGS_PICKER_PANEL_ID,
    defaultWidth: TAGS_PICKER_MIN_WIDTH,
    defaultHeight: TAGS_PICKER_MIN_HEIGHT,
    minWidth: TAGS_PICKER_MIN_WIDTH,
    minHeight: TAGS_PICKER_MIN_HEIGHT,
    resizable: true,
    moveAllowSelectors: TAGS_PICKER_MOVE_ALLOW,
    scrollBlockSelectors: TAGS_PICKER_SCROLL_BLOCK
  });
  const [tagSearch, setTagSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [catalogReady, setCatalogReady] = useState(false);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);
  const [categoryModal, setCategoryModal] = useState<CategorySettingsModalState | null>(null);
  const [localSelectedTagIds, setLocalSelectedTagIds] = useState(selectedTagIds);

  useEffect(() => {
    setLocalSelectedTagIds(selectedTagIds);
  }, [selectedTagIds]);

  const handleToggleTag = (tagId: string) => {
    setLocalSelectedTagIds((prev) => {
      const has = prev.includes(tagId);
      return has ? prev.filter((id) => id !== tagId) : [...prev, tagId];
    });
    void onToggleTag(tagId);
  };

  const reloadCatalog = async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const map: Record<string, TagRecord[]> = {};
    cats.forEach((c, i) => {
      map[c.id] = lists[i] ?? [];
    });
    setTagsByCat(map);
    setCatalogReady(true);
  };

  useEffect(() => {
    void reloadCatalog();
    const onCategoriesChanged = () => void reloadCatalog();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCategoriesChanged);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCategoriesChanged);
    };
  }, []);

  const searchQ = normalizeSearchQuery(tagSearch);

  const sidebarCategories = useMemo(
    () => filterSidebarCategories(categories, tagsByCat, searchQ, selectedCategoryId),
    [categories, tagsByCat, searchQ, selectedCategoryId]
  );

  const tagGroups = useMemo(
    () => buildTagPickerGroups(categories, tagsByCat, searchQ, selectedCategoryId),
    [categories, tagsByCat, searchQ, selectedCategoryId]
  );

  const showEmptyCatalog = catalogReady && categories.length === 0;
  const totalTagCount = useMemo(
    () => Object.values(tagsByCat).reduce((count, tags) => count + tags.length, 0),
    [tagsByCat]
  );
  const showEmptyTags =
    catalogReady && !showEmptyCatalog && totalTagCount === 0 && searchQ.length === 0;
  const showEmptyCreate = searchQ.length > 0 && tagGroups.length === 0 && categories.length > 0;

  const openCreateTag = (categoryId: string, initialName?: string) => {
    setTagModal({ mode: 'create', categoryId, initialName });
  };

  const openCreateFromSearch = () => {
    const categoryId = selectedCategoryId ?? categories[0]?.id;
    if (!categoryId) return;
    openCreateTag(categoryId, tagSearch.trim());
  };

  const openCreateFirstTag = () => {
    const categoryId = selectedCategoryId ?? categories[0]?.id;
    if (!categoryId) return;
    openCreateTag(categoryId);
  };

  useLayoutEffect(() => {
    if (panelRef.current) void hydrateArcNavbarIcons(panelRef.current);
  }, [
    panelRef,
    categories,
    localSelectedTagIds,
    tagSearch,
    selectedCategoryId,
    tagGroups,
    tagModal,
    categoryModal,
    sidebarCategories,
    showEmptyCatalog,
    showEmptyTags
  ]);

  const picker = (
    <ArcAnimatedModalHost
      onClose={onClose}
      closeDisabled={tagModal != null || categoryModal != null}
      className="arc-add-tags-picker-host"
      hostClassName="arc-modal-host--card-detail-nested"
    >
      {() => (
        <>
          <div
            ref={panelRef}
            className="arc-add-tags-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Добавить метки"
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
          >
        <aside
          className="arc-add-tags-picker__sidebar context-menu panel elevation-raised context-menu--static arc-ui-kit-scope"
          data-elevation="raised"
          data-typo-tone="white"
          data-btn-size="m"
          role="menu"
          aria-label="Категории меток"
        >
          <div className="arc-add-tags-picker__sidebar-head">
            <div className="arc-add-tags-picker__sidebar-pad">
              <PickerCategoryItem
                label="Все категории"
                active={selectedCategoryId === null}
                onSelect={() => setSelectedCategoryId(null)}
              />
            </div>
            <ContextMenuSeparator />
          </div>
          <div className="arc-add-tags-picker__sidebar-scroll context-menu__list">
            <div className="arc-add-tags-picker__sidebar-pad">
              {sidebarCategories.map((cat) => (
                <PickerCategoryItem
                  key={cat.id}
                  label={cat.name}
                  active={selectedCategoryId === cat.id}
                  onSelect={() => setSelectedCategoryId(cat.id)}
                />
              ))}
            </div>
          </div>
          <div className="arc-add-tags-picker__sidebar-foot">
            <ContextMenuSeparator />
            <div className="arc-add-tags-picker__sidebar-pad">
              <button
                type="button"
                className="btn btn-outline btn-ds arc-add-tags-picker__sidebar-new"
                onClick={() => setCategoryModal({ mode: 'create' })}
              >
                <span className="btn-ds__value">Новая категория</span>
                <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        <div
          className="arc-add-tags-picker__content panel elevation-default arc-ui-kit-scope"
          data-elevation="default"
          data-typo-tone="white"
          data-input-size="m"
          data-btn-size="s"
        >
          <div className="arc-add-tags-picker__content-fixed">
            <div className="arc-add-tags-picker__content-inset">
              <div
                className={`field field-full search-live arc-add-tags-picker__search${tagSearch.length > 0 ? ' has-value' : ''}`}
              >
                <div className="input search-field input-slots">
                  <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                  <input
                    ref={tagSearchInputRef}
                    className="search-inner slot-value"
                    placeholder="Поиск по категориям и меткам…"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    aria-label="Поиск по категориям и меткам"
                  />
                  <button
                    type="button"
                    className="input-inline-icon search-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
                    aria-label="Очистить"
                    onClick={() => {
                      setTagSearch('');
                      tagSearchInputRef.current?.focus();
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="context-menu__sep" role="separator" aria-hidden="true" />
          </div>

          <div className="arc-add-tags-picker__tags-scroll">
            <div className="arc-add-tags-picker__tags-pad">
            {showEmptyCatalog ? (
              <p className="text-s arc-add-tags-picker__empty-catalog">Категорий пока нет.</p>
            ) : showEmptyTags ? (
              <div className="arc-add-tags-picker__empty arc-add-tags-picker__group-inset">
                <p className="text-m arc-add-tags-picker__empty-text">Меток пока нет.</p>
                <button type="button" className="btn btn-outline btn-ds" onClick={openCreateFirstTag}>
                  <span className="btn-ds__value">Создать метку</span>
                </button>
              </div>
            ) : showEmptyCreate ? (
              <div className="arc-add-tags-picker__empty arc-add-tags-picker__group-inset">
                <p className="text-m arc-add-tags-picker__empty-text">Нет совпадений по запросу.</p>
                <button type="button" className="btn btn-outline btn-ds" onClick={openCreateFromSearch}>
                  <span className="btn-ds__value">Создать метку</span>
                </button>
              </div>
            ) : (
              tagGroups.map(({ cat, tags }, index) => (
                <div key={cat.id} className="arc-add-tags-picker__group">
                  {index > 0 ? <div className="context-menu__sep" role="separator" aria-hidden="true" /> : null}
                  <div className="arc-add-tags-picker__group-inset">
                  <div className="arc-add-tags-picker__group-title">
                    <TruncatedTextWithTooltip
                      text={cat.name}
                      className="arc-add-tags-picker__group-name"
                    />
                    <span className="arc-add-tags-picker__group-count">{tags.length}</span>
                  </div>
                  <div className="tags-row arc-add-tag-chips--with-add">
                    {tags.map((t) => (
                      <TagChipToggleWithTooltip
                        key={t.id}
                        tag={t}
                        categoryColorHex={cat.colorHex}
                        selected={localSelectedTagIds.includes(t.id)}
                        onToggle={() => handleToggleTag(t.id)}
                      />
                    ))}
                    <div className="arc-ui-kit-scope" data-elevation="sunken" data-typo-tone="white" data-btn-size="s">
                      <Tooltip content="Новая метка" position="top">
                        <button
                          type="button"
                          className="btn btn-secondary btn-ds btn-icon-only arc-add-tag-new-btn"
                          onClick={() => openCreateTag(cat.id)}
                          aria-label={`Добавить метку в категорию «${cat.name}»`}
                        >
                          <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
          </div>

          {tagModal ? (
            <TagSettingsModal
              state={tagModal}
              categories={categories}
              hostClassName="arc-modal-host--card-detail-nested arc-add-tags-picker-nested-modal"
              onClose={() => setTagModal(null)}
              onCreate={async (payload) => {
                const created = await addTag(payload.categoryId, payload.name, {
                  description: payload.description,
                  tooltipImageDataUrl: payload.tooltipImageDataUrl
                });
                if (!localSelectedTagIds.includes(created.id)) {
                  handleToggleTag(created.id);
                }
                await reloadCatalog();
              }}
              onSave={async (payload) => {
                await updateTag(payload.tagId, {
                  name: payload.name,
                  categoryId: payload.categoryId,
                  description: payload.description,
                  tooltipImageDataUrl: payload.tooltipImageDataUrl
                });
                await reloadCatalog();
              }}
              onDelete={async (tagId) => {
                await deleteTag(tagId);
                await reloadCatalog();
              }}
            />
          ) : null}

          {categoryModal ? (
            <CategorySettingsModal
              state={categoryModal}
              stats={null}
              hostClassName="arc-modal-host--card-detail-nested arc-add-tags-picker-nested-modal"
              onClose={() => setCategoryModal(null)}
              onCreate={async (payload) => {
                const created = await addCategory(payload.name, payload.colorHex, {
                  weight: payload.weight,
                  description: payload.description
                });
                setSelectedCategoryId(created.id);
                await reloadCatalog();
              }}
              onSave={async () => {}}
              onDelete={async () => {}}
            />
          ) : null}
        </>
      )}
    </ArcAnimatedModalHost>
  );

  return createPortal(picker, document.body);
}
