import { useEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type SearchPanelRecentQueriesProps = {
  queries: readonly string[];
  onSelect: (query: string) => void;
};

/** Список недавних AI-запросов (Figma 891-16381). */
export default function SearchPanelRecentQueries({ queries, onSelect }: SearchPanelRecentQueriesProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) void hydrateArcNavbarIcons(listRef.current);
  }, [queries]);

  if (queries.length === 0) return null;

  return (
    <div ref={listRef} className="arc-search-panel-recent-queries">
      {queries.map((query) => (
        <button
          key={query}
          type="button"
          className="arc-search-panel-recent-query"
          onClick={() => onSelect(query)}
        >
          <span className="text-m arc-search-panel-recent-query__text">{query}</span>
          <span className="arc-icon-redo arc-search-panel-recent-query__reuse" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
