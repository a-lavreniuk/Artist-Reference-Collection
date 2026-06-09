import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuSeparator } from '../context-menu';
import TagChipToggleWithTooltip from '../tags/TagChipToggleWithTooltip';
import TagSettingsModal, { type TagSettingsModalState } from '../tags/TagSettingsModal';
import { Tooltip } from '../tooltip/Tooltip';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
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
          <span className="context-menu__item-label">{label}</span>
        </span>
      </span>
    </button>
  );
}

export default function CardDetailTagsModal({ selectedTagIds, onClose, onToggleTag }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);

  const reloadCatalog = async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const map: Record<string, TagRecord[]> = {};
    cats.forEach((c, i) => {
      map[c.id] = lists[i] ?? [];
    });
    setTagsByCat(map);
  };

  useEffect(() => {
    void reloadCatalog();
    const onCatalog = () => void reloadCatalog();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCatalog);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onCatalog);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCatalog);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onCatalog);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || tagModal) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, tagModal]);

  const searchQ = normalizeSearchQuery(tagSearch);

  const sidebarCategories = useMemo(
    () => filterSidebarCategories(categories, tagsByCat, searchQ, selectedCategoryId),
    [categories, tagsByCat, searchQ, selectedCategoryId]
  );

  const tagGroups = useMemo(
    () => buildTagPickerGroups(categories, tagsByCat, searchQ, selectedCategoryId),
    [categories, tagsByCat, searchQ, selectedCategoryId]
  );

  const showEmptyCreate = searchQ.length > 0 && tagGroups.length === 0 && categories.length > 0;

  const openCreateTag = (categoryId: string, initialName?: string) => {
    setTagModal({ mode: 'create', categoryId, initialName });
  };

  const openCreateFromSearch = () => {
    const categoryId = selectedCategoryId ?? categories[0]?.id;
    if (!categoryId) return;
    openCreateTag(categoryId, tagSearch.trim());
  };

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [categories, selectedTagIds, tagSearch, selectedCategoryId, tagGroups, tagModal, sidebarCategories]);

  const picker = (
    <div
      ref={hostRef}
      className="arc-add-tags-picker-host arc-modal-host--card-detail-nested"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="arc-add-tags-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить метки"
        onClick={(e) => e.stopPropagation()}
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
            {showEmptyCreate ? (
              <div className="arc-add-tags-picker__empty arc-add-tags-picker__group-inset">
                <p className="typo-p-m arc-add-tags-picker__empty-text">Нет совпадений по запросу.</p>
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
                    <span className="arc-add-tags-picker__group-name">{cat.name}</span>
                    <span className="arc-add-tags-picker__group-count">{tags.length}</span>
                  </div>
                  <div className="tags-row arc-add-tag-chips--with-add">
                    {tags.map((t) => (
                      <TagChipToggleWithTooltip
                        key={t.id}
                        tag={t}
                        categoryColorHex={cat.colorHex}
                        selected={selectedTagIds.includes(t.id)}
                        onToggle={() => void onToggleTag(t.id)}
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
            if (!selectedTagIds.includes(created.id)) {
              await onToggleTag(created.id);
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
    </div>
  );

  return createPortal(picker, document.body);
}
