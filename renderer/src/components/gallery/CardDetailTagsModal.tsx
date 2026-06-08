import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TagChipToggleWithTooltip from '../tags/TagChipToggleWithTooltip';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  selectedTagIds: string[];
  onClose: () => void;
  onApply: (tagIds: string[]) => void;
};

export default function CardDetailTagsModal({ selectedTagIds, onClose, onApply }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [draftIds, setDraftIds] = useState<string[]>(selectedTagIds);

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
    setDraftIds(selectedTagIds);
  }, [selectedTagIds]);

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

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [categories, draftIds, tagSearch]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const rows: { cat: CategoryRecord; tags: TagRecord[] }[] = [];
    for (const cat of categories) {
      const allT = tagsByCat[cat.id] ?? [];
      const tags = q ? allT.filter((t) => t.name.toLowerCase().includes(q)) : allT;
      if (!q || tags.length > 0 || cat.name.toLowerCase().includes(q)) {
        rows.push({ cat, tags: q ? tags : allT });
      }
    }
    return rows;
  }, [categories, tagsByCat, tagSearch]);

  const toggleTag = (tagId: string) => {
    setDraftIds((prev) => {
      const set = new Set(prev);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      return [...set];
    });
  };

  return (
    <div
      ref={hostRef}
      className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="arc-modal arc-card-detail-tags-modal arc-ui-kit-scope"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="m"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcCardDetailTagsTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcCardDetailTagsTitle">
            Метки
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body arc-card-detail-tags-modal-body">
          <div className="field field-full input-live arc-card-detail-tags-modal-search">
            <div className="input input--size-m input-slots search-live">
              <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
              <input
                className="search-inner slot-value"
                placeholder="Поиск метки или категории"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                aria-label="Поиск метки или категории"
              />
            </div>
          </div>
          <div className="arc-card-detail-tags-modal-scroll">
            {filteredTags.map(({ cat, tags }, index) => (
              <div key={cat.id} className="arc-add-tag-category-row">
                <p className="text-m arc-add-tag-category-title">{cat.name}</p>
                <div className="arc-add-tag-chips-column">
                  {index > 0 ? <div className="arc-add-tag-sep" role="separator" aria-hidden="true" /> : null}
                  <div className="tags-row arc-add-tag-chips--with-add">
                    {tags.map((t) => (
                      <TagChipToggleWithTooltip
                        key={t.id}
                        tag={t}
                        categoryColorHex={cat.colorHex}
                        selected={draftIds.includes(t.id)}
                        onToggle={() => toggleTag(t.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds" onClick={onClose}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button
            type="button"
            className="btn btn-brand btn-ds"
            onClick={() => {
              onApply(draftIds);
              onClose();
            }}
          >
            <span className="btn-ds__value">Готово</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
