import { useLayoutEffect, useRef } from 'react';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import TagCategoryDropSurface from './TagCategoryDropSurface';
import TagManageChip from './TagManageChip';

type Props = {
  category: CategoryRecord;
  tags: TagRecord[];
  collapsed: boolean;
  mainDropEnabled: boolean;
  draggingTagId: string | null;
  allTags: TagRecord[];
  onToggleCollapse: () => void;
  onAddTag: () => void;
  onEditTag: (tag: TagRecord) => void;
  onTagDragStart: (tagId: string) => void;
  onTagDragEnd: () => void;
  onTagDrop: (tagId: string, targetCategoryId: string) => Promise<void>;
  onEditCategory: () => void;
};

export default function TagsCategorySection({
  category,
  tags,
  collapsed,
  mainDropEnabled,
  draggingTagId,
  allTags,
  onToggleCollapse,
  onAddTag,
  onEditTag,
  onTagDragStart,
  onTagDragEnd,
  onTagDrop,
  onEditCategory
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [category, tags, collapsed, draggingTagId]);

  const tagCloud = (
    <div className="arc-tags-category-section__tags">
      {tags.map((tag) => (
        <TagManageChip
          key={tag.id}
          tag={tag}
          categoryColorHex={category.colorHex}
          draggingTagId={draggingTagId}
          dragDisabled={false}
          onEdit={onEditTag}
          onDragStart={onTagDragStart}
          onDragEnd={onTagDragEnd}
        />
      ))}
      <span
        className="arc-ui-kit-scope"
        data-elevation="sunken"
        data-typo-tone="white"
        data-btn-size="s"
      >
        <Tooltip content="Новая метка" position="top">
          <button
            type="button"
            className="btn btn-secondary btn-ds btn-icon-only arc-add-tag-new-btn"
            aria-label={`Добавить метку в «${category.name}»`}
            onClick={onAddTag}
          >
            <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
          </button>
        </Tooltip>
      </span>
    </div>
  );

  return (
    <section ref={rootRef} className="arc-tags-category-section" aria-labelledby={`arc-tags-cat-${category.id}`}>
      <div className="arc-tags-category-section__header">
        <h2 className="arc-tags-category-section__title" id={`arc-tags-cat-${category.id}`}>
          <button
            type="button"
            className="arc-tags-category-section__name-btn"
            onClick={onEditCategory}
          >
            <span className="arc-tags-category-section__name">{category.name}</span>
          </button>
          <span className="arc-tags-category-section__count">{tags.length}</span>
        </h2>
        <div className="arc-tags-category-section__actions">
          <Tooltip content={collapsed ? 'Развернуть' : 'Свернуть'} position="top">
            <span
              className="arc-card-detail-section-toggle-scope arc-ui-kit-scope"
              data-btn-size="s"
            >
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds arc-card-detail-section-toggle"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Показать метки категории' : 'Скрыть метки категории'}
                onClick={onToggleCollapse}
              >
                <span
                  className={`btn-icon-only__glyph ${collapsed ? 'arc-icon-chevron-bottom' : 'arc-icon-chevron-peak'}`}
                  aria-hidden="true"
                />
              </button>
            </span>
          </Tooltip>
        </div>
      </div>
      {!collapsed ? (
        mainDropEnabled ? (
          <TagCategoryDropSurface
            className="arc-tags-category-section__drop"
            categoryId={category.id}
            draggingTagId={draggingTagId}
            allTags={allTags}
            onTagDrop={onTagDrop}
          >
            {tagCloud}
          </TagCategoryDropSurface>
        ) : (
          tagCloud
        )
      ) : null}
    </section>
  );
}
