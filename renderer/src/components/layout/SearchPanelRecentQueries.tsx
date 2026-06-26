import { useEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type SearchPanelRecentQueriesProps = {
  queries: readonly string[];
  onSelect: (query: string) => void;
  onReuse: (query: string) => void;
};

/** Список недавних AI-запросов (Figma 891-16381, иконка reuse 1585-8088 — 16px). */
export default function SearchPanelRecentQueries({ queries, onSelect, onReuse }: SearchPanelRecentQueriesProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) void hydrateArcNavbarIcons(listRef.current);
  }, [queries]);

  if (queries.length === 0) return null;

  return (
    <div ref={listRef} className="context-menu__list arc-search-panel-recent-queries">
      {queries.map((query) => (
        <div key={query} className="context-menu__item arc-search-panel-recent-query" role="group" aria-label={query}>
          <span className="context-menu__item-inner">
            <button type="button" className="arc-search-panel-recent-query__label" onClick={() => onSelect(query)}>
              <span className="context-menu__item-label-cluster">
                <span className="context-menu__item-label">{query}</span>
              </span>
            </button>
            <button
              type="button"
              className="arc-search-panel-recent-query__action"
              aria-label={`Повторить запрос «${query}»`}
              onClick={() => onReuse(query)}
            >
              <span
                className="context-menu__item-icon tab-icon arc-icon-reuse"
                data-arc-icon-size="s"
                aria-hidden="true"
              />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
