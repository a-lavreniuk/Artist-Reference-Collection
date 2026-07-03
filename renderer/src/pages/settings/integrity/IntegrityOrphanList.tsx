import { useState } from 'react';
import { ORPHAN_LIST_PAGE_SIZE } from '../../../services/libraryIntegrity';
import { Tooltip } from '../../../components/tooltip/Tooltip';

type Props = {
  paths: string[];
  libraryRootAbs: string | null;
  busy: boolean;
  onDelete: (relPath: string) => void;
  onDeleteAll: (paths: string[]) => void;
  onShowInFolder: (relPath: string) => void;
};

function toDisplayPath(rootAbs: string | null, relativePath: string): string {
  const rel = relativePath.replace(/\//g, '\\');
  if (!rootAbs) return rel;
  const root = rootAbs.replace(/[\\/]+$/, '');
  return `${root}\\${rel}`;
}

export default function IntegrityOrphanList({
  paths,
  libraryRootAbs,
  busy,
  onDelete,
  onDeleteAll,
  onShowInFolder
}: Props) {
  const [visibleCount, setVisibleCount] = useState(ORPHAN_LIST_PAGE_SIZE);
  const visible = paths.slice(0, visibleCount);
  const hasMore = paths.length > visibleCount;

  return (
    <div className="arc-integrity-orphans">
      <div className="arc-integrity-orphans__toolbar">
        <p className="typo-p-m arc-integrity-orphans__count">Лишние файлы: {paths.length}</p>
        {paths.length > 0 ? (
          <button
            type="button"
            className="btn btn-danger btn-ds"
            disabled={busy}
            onClick={() => onDeleteAll(paths)}
          >
            <span className="btn-ds__value">Удалить все</span>
          </button>
        ) : null}
      </div>
      <ul className="arc-integrity-orphans__list">
        {visible.map((rel) => {
          const abs = toDisplayPath(libraryRootAbs, rel);
          return (
            <li key={rel} className="arc-integrity-orphans__item">
              <Tooltip content={abs} delay={500} position="top" className="arc-integrity-orphans__path-tooltip">
                <span className="typo-p-m arc-integrity-orphans__path">{rel}</span>
              </Tooltip>
              <div className="arc-integrity-orphans__actions">
                <button
                  type="button"
                  className="btn btn-outline btn-ds"
                  disabled={busy}
                  onClick={() => onShowInFolder(rel)}
                >
                  <span className="btn-ds__value">В папке</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-ds"
                  disabled={busy}
                  onClick={() => onDelete(rel)}
                >
                  <span className="btn-ds__value">Удалить</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="btn btn-outline btn-ds arc-integrity-orphans__more"
          onClick={() => setVisibleCount((n) => n + ORPHAN_LIST_PAGE_SIZE)}
        >
          <span className="btn-ds__value">Показать ещё {Math.min(ORPHAN_LIST_PAGE_SIZE, paths.length - visibleCount)}</span>
        </button>
      ) : null}
    </div>
  );
}
