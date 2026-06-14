import './NavbarSearch.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import {
  ARC_DETAIL_QUERY_CARD,
  removeCardFilterFromParams,
  setSearchAndDetailCardInParams
} from '../../search/openCardUrl';
import {
  ARC_SEARCH_QUERY_CARD,
  ARC_SEARCH_QUERY_TAG,
  parseSearchCardId,
  parseSearchTagIds
} from '../../search/searchUrl';
import {
  getRecentTagIds,
  hasCompletedSearchSession,
  markSearchSessionCompleted,
  pushRecentTagId,
  removeRecentTagId
} from '../../search/recentSearchTags';
import SearchPanelTagChip from './SearchPanelTagChip';
import NavbarSearchModes from './NavbarSearchModes';
import { formatNavbarTabCount } from '../../search/formatNavbarTabCount';
import {
  readNavbarSearchMode,
  SEARCH_MODE_META,
  type NavbarSearchMode,
  writeNavbarSearchMode
} from '../../search/navbarSearchMode';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import {
  ARC_SEARCH_QUERY_AI,
  parseSearchAiQuery,
  setSearchAiInParams
} from '../../search/searchUrl';

export { formatNavbarTabCount } from '../../search/formatNavbarTabCount';

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePrefix(q: string): string {
  return q.trim().toLowerCase();
}

type NavbarSearchProps = {
  onPanelOpenChange?: (open: boolean) => void;
};

export default function NavbarSearch({ onPanelOpenChange }: NavbarSearchProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdFilter = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const aiQuery = useMemo(() => parseSearchAiQuery(searchParams), [searchParams]);

  const [searchMode, setSearchMode] = useState<NavbarSearchMode>(() => readNavbarSearchMode());
  const { prefs, ready: prefsReady } = useAppPreferences();
  const aiSearchEnabled = prefsReady && prefs?.aiSemanticSearchEnabled === true;

  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const tagsByCategoryRef = useRef<Map<string, TagRecord[]>>(new Map());
  const [tagsVersion, setTagsVersion] = useState(0);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const [dropdownLayout, setDropdownLayout] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [fieldError, setFieldError] = useState(false);
  const [recentTick, setRecentTick] = useState(0);

  const tagsIndex = useMemo(() => {
    const m = new Map<string, TagRecord>();
    for (const [, list] of tagsByCategoryRef.current) {
      for (const t of list) m.set(t.id, t);
    }
    return m;
  }, [tagsVersion]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    if (!aiSearchEnabled && searchMode === 'ai') {
      setSearchMode('tags');
      writeNavbarSearchMode('tags');
    }
  }, [aiSearchEnabled, searchMode]);

  const loadIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const sorted = [...cats].sort((a, b) => a.sortIndex - b.sortIndex);
    setCategories(sorted);
    const map = new Map<string, TagRecord[]>();
    await Promise.all(
      sorted.map(async (c) => {
        const tags = await getTagsByCategory(c.id);
        map.set(c.id, tags);
      })
    );
    tagsByCategoryRef.current = map;
    setTagsVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    const onCats = () => void loadIndex();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onCats);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onCats);
    };
  }, [loadIndex]);

  const navigateToSearchHost = useCallback(() => {
    if (location.pathname.startsWith('/collections')) {
      return;
    }
    if (location.pathname !== '/gallery') {
      const s = searchParams.toString();
      navigate({ pathname: '/gallery', search: s ? `?${s}` : '' });
    }
  }, [location.pathname, navigate, searchParams]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    navigateToSearchHost();
    void loadIndex();
  }, [loadIndex, navigateToSearchHost]);

  const panelHadInteraction = useRef(false);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setFieldError(false);
    if (panelHadInteraction.current && !hasCompletedSearchSession()) {
      markSearchSessionCompleted();
    }
    panelHadInteraction.current = false;
  }, []);

  const updateDropdownLayout = useCallback(() => {
    if (!panelOpen || !searchAnchorRef.current) return;
    const r = searchAnchorRef.current.getBoundingClientRect();
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--s-2').trim();
    const gapBelowInput = Number.parseFloat(raw) || 8;
    setDropdownLayout({ top: r.bottom + gapBelowInput, left: r.left, width: r.width });
  }, [panelOpen]);

  useLayoutEffect(() => {
    updateDropdownLayout();
  }, [panelOpen, draft, selectedTagIds.length, cardIdFilter, updateDropdownLayout]);

  useEffect(() => {
    if (!panelOpen) return;
    const onMove = () => updateDropdownLayout();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [panelOpen, updateDropdownLayout]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  useEffect(() => {
    onPanelOpenChange?.(panelOpen);
  }, [panelOpen, onPanelOpenChange]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    document.body.classList.add('arc-search-panel-open');
    return () => {
      document.body.classList.remove('arc-search-panel-open');
    };
  }, [panelOpen]);

  const toggleTag = (tagId: string) => {
    panelHadInteraction.current = true;
    const had = selectedTagIds.includes(tagId);
    const next = new Set(selectedTagIds);
    if (had) next.delete(tagId);
    else {
      next.add(tagId);
      pushRecentTagId(tagId);
      setRecentTick((x) => x + 1);
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete(ARC_SEARCH_QUERY_TAG);
        for (const id of [...next]) {
          n.append(ARC_SEARCH_QUERY_TAG, id);
        }
        n.delete(ARC_SEARCH_QUERY_CARD);
        return n;
      },
      { replace: true }
    );
    setDraft('');
    setFieldError(false);
  };

  const removeTag = (tagId: string) => {
    panelHadInteraction.current = true;
    const next = selectedTagIds.filter((id) => id !== tagId);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete(ARC_SEARCH_QUERY_TAG);
        for (const id of next) {
          n.append(ARC_SEARCH_QUERY_TAG, id);
        }
        return n;
      },
      { replace: true }
    );
  };

  /** Полный сброс: текст, все метки, фильтр по ID; панель поиска не закрываем. */
  const resetSearchField = () => {
    panelHadInteraction.current = true;
    const n = new URLSearchParams(searchParams);
    n.delete(ARC_SEARCH_QUERY_TAG);
    n.delete(ARC_SEARCH_QUERY_CARD);
    n.delete(ARC_SEARCH_QUERY_AI);
    n.delete(ARC_DETAIL_QUERY_CARD);
    setSearchParams(n, { replace: true });
    setDraft('');
    setFieldError(false);
  };

  const applyAiQuery = (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    panelHadInteraction.current = true;
    setSearchParams(setSearchAiInParams(searchParams, query), { replace: true });
    setDraft('');
    setFieldError(false);
    closePanel();
    navigateToSearchHost();
  };

  const handleModeChange = (mode: NavbarSearchMode) => {
    setSearchMode(mode);
    writeNavbarSearchMode(mode);
    if (mode === 'ai') {
      setPanelOpen(false);
      const n = new URLSearchParams(searchParams);
      n.delete(ARC_SEARCH_QUERY_TAG);
      n.delete(ARC_SEARCH_QUERY_CARD);
      setSearchParams(n, { replace: true });
      return;
    }
    const n = new URLSearchParams(searchParams);
    n.delete(ARC_SEARCH_QUERY_AI);
    setSearchParams(n, { replace: true });
  };

  const applyCardIdFilter = (raw: string) => {
    const id = raw.trim();
    if (!id) return;
    panelHadInteraction.current = true;
    setSearchParams(setSearchAndDetailCardInParams(searchParams, id));
    setDraft('');
    setFieldError(false);
    markSearchSessionCompleted();
  };

  const q = normalizePrefix(draft);

  const filteredTree = useMemo(() => {
    const rows: { cat: CategoryRecord; tags: TagRecord[] }[] = [];
    if (!q) {
      for (const cat of categories) {
        const tags = tagsByCategoryRef.current.get(cat.id) ?? [];
        rows.push({ cat, tags });
      }
      return rows;
    }
    for (const cat of categories) {
      const tags = tagsByCategoryRef.current.get(cat.id) ?? [];
      const catHit = cat.name.toLowerCase().startsWith(q);
      const tagHits = tags.filter(
        (t) =>
          catHit ||
          t.name.toLowerCase().startsWith(q) ||
          (t.description?.trim() && t.description.toLowerCase().startsWith(q))
      );
      if (tagHits.length > 0) {
        rows.push({ cat, tags: catHit ? tags : tagHits });
      }
    }
    return rows;
  }, [categories, q, tagsVersion]);

  const suggestionMatchesDraft = q.length > 0 && filteredTree.some((r) => r.tags.length > 0);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMode === 'ai') {
        if (draft.trim().length > 0) {
          applyAiQuery(draft);
        } else if (fieldError) {
          setFieldError(true);
        }
        return;
      }
      if (UUID_LIKE.test(draft.trim())) {
        applyCardIdFilter(draft.trim());
        closePanel();
        return;
      }
      if (q.length > 0 && !suggestionMatchesDraft && !UUID_LIKE.test(draft.trim())) {
        setFieldError(true);
        return;
      }
    }
  };

  const placeholder = SEARCH_MODE_META[searchMode].placeholder;
  const isTagsMode = searchMode === 'tags';
  const isAiMode = searchMode === 'ai';

  const hasValue =
    draft.trim().length > 0 ||
    selectedTagIds.length > 0 ||
    Boolean(cardIdFilter) ||
    Boolean(aiQuery);

  const recentIds = useMemo(() => getRecentTagIds(), [panelOpen, tagsVersion, recentTick]);

  const showRecent = hasCompletedSearchSession() && recentIds.length > 0 && !q;

  return (
    <>
      <div className="arc-navbar-search-anchor" ref={searchAnchorRef}>
      <div className="arc-navbar-search-row">
        <NavbarSearchModes mode={searchMode} aiSearchEnabled={aiSearchEnabled} onModeChange={handleModeChange} />
        <div className="arc-navbar-search-stack">
        <div
          className={`field field-full search-multiselect-live arc-navbar-search-live${hasValue ? ' has-value' : ''}${fieldError ? ' field-error' : ''}`}
          data-live-search-multi
        >
          <div className="input search-multiselect input--size-l input-slots arc-navbar-search">
            <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
            {isTagsMode
              ? selectedTagIds.map((id) => {
              const t = tagsIndex.get(id);
              const cat = t ? categoryById.get(t.categoryId) : undefined;
              const color = cat?.colorHex ?? 'var(--gray-500)';
              const count = t?.usageCount ?? 0;
              const countLabel = count > 0 ? formatNavbarTabCount(count) : null;
              const remove = () => removeTag(id);
              return (
                <span
                  key={id}
                  role="button"
                  tabIndex={0}
                  className="chip chip-active"
                  aria-label={`Снять метку ${t?.name ?? ''}`}
                  onClick={remove}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      remove();
                    }
                  }}
                >
                  <span className="chip-color" style={{ background: color }} aria-hidden="true" />
                  <span>{t?.name ?? id.slice(0, 8)}</span>
                  {countLabel ? <span className="chip-count">{countLabel}</span> : null}
                  <span className="chip-remove" aria-hidden="true">
                    ✕
                  </span>
                </span>
              );
            })
              : null}
            {isTagsMode && cardIdFilter ? (
              <span
                role="button"
                tabIndex={0}
                className="chip chip-active"
                aria-label="Сбросить фильтр по ID"
                onClick={() => {
                  panelHadInteraction.current = true;
                  setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    panelHadInteraction.current = true;
                    setSearchParams(removeCardFilterFromParams(searchParams), { replace: true });
                  }
                }}
              >
                <span className="chip-color" style={{ background: 'var(--gray-300)' }} aria-hidden="true" />
                <span>ID: {cardIdFilter.slice(0, 8)}…</span>
                <span className="chip-remove" aria-hidden="true">
                  ✕
                </span>
              </span>
            ) : null}
            {isAiMode && aiQuery ? (
              <span className="chip chip-active" aria-label="AI запрос">
                <span className="chip-color" style={{ background: 'var(--brand-500)' }} aria-hidden="true" />
                <span>{aiQuery.length > 48 ? `${aiQuery.slice(0, 48)}…` : aiQuery}</span>
              </span>
            ) : null}
            <input
              className="search-inner slot-value"
              type="text"
              placeholder={placeholder}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setFieldError(false);
              }}
              onKeyDown={onInputKeyDown}
              onFocus={() => {
                if (isTagsMode) openPanel();
              }}
              onClick={() => {
                if (isTagsMode) openPanel();
              }}
            />
            <button
              className="input-inline-icon search-multiselect-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
              type="button"
              aria-label="Сбросить поиск"
              onClick={resetSearchField}
            />
          </div>
        </div>
        </div>
      </div>

      {isTagsMode && panelOpen && dropdownLayout ? (
        <>
          <button
            type="button"
            className="arc-search-backdrop"
            aria-label="Закрыть поиск"
            onClick={closePanel}
          />
          <div
            className="arc-search-panel arc-ui-kit-scope"
            data-elevation="raised"
            data-typo-tone="white"
            style={{
              top: dropdownLayout.top,
              left: dropdownLayout.left,
              width: dropdownLayout.width
            }}
          >
            <div className="arc-add-tags-scroll arc-search-panel-scroll">
              <div className="arc-add-tags-categories arc-search-tag-picker-grid">
                {showRecent ? (
                  <div className="arc-add-tag-category-row">
                    <p className="text-m arc-add-tag-category-title">Недавние запросы</p>
                    <div className="arc-add-tag-chips-column">
                      <div className="tags-row arc-search-tags-row">
                        {recentIds.map((rid) => {
                          const t = tagsIndex.get(rid);
                          if (!t) return null;
                          const cat = categoryById.get(t.categoryId);
                          if (!cat) return null;
                          return (
                            <SearchPanelTagChip
                              key={rid}
                              tag={t}
                              category={cat}
                              selected={selectedTagIds.includes(rid)}
                              onToggle={() => toggleTag(rid)}
                              onRemoveFromRecent={() => {
                                removeRecentTagId(rid);
                                setRecentTick((x) => x + 1);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {showRecent && (filteredTree.length > 0 || (filteredTree.length === 0 && Boolean(q))) ? (
                  <div
                    className="arc-card-inspect-sep arc-card-inspect-sep--full-bleed arc-search-panel-fullbleed-sep arc-search-panel-sep-span"
                    role="separator"
                  />
                ) : null}

                {filteredTree.length === 0 && q ? (
                  <p className="typo-p-m arc-search-empty-hint arc-search-panel-empty-span">
                    Нет совпадений по запросу.
                  </p>
                ) : (
                  filteredTree.map(({ cat, tags }, index) => (
                    <div key={cat.id} className="arc-add-tag-category-row">
                      <p className="text-m arc-add-tag-category-title">{cat.name}</p>
                      <div className="arc-add-tag-chips-column">
                        {index > 0 ? (
                          <div className="arc-add-tag-sep" role="separator" aria-hidden="true" />
                        ) : null}
                        <div className="tags-row arc-search-tags-row">
                          {tags.map((t) => (
                            <SearchPanelTagChip
                              key={t.id}
                              tag={t}
                              category={cat}
                              selected={selectedTagIds.includes(t.id)}
                              onToggle={() => toggleTag(t.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
      </div>
    </>
  );
}
