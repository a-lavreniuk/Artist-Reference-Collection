import { useLayoutEffect, useRef } from 'react';
import { formatBytes } from '../../utils/formatBytes';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { DuplicatePairStatus, DuplicatesCompareMode, ScannedDuplicatePair } from './duplicateCompareTypes';

type Props = {
  scannedCards: number;
  duplicatesFound: number;
  spaceSavedBytes: number;
  mode: DuplicatesCompareMode;
  onModeChange: (mode: DuplicatesCompareMode) => void;
  pairs: ScannedDuplicatePair[];
  statuses: Record<string, DuplicatePairStatus>;
  thumbUrls: Record<string, string>;
  selectedIndex: number;
  onSelectPair: (index: number) => void;
  onDismissPair: (index: number) => void;
  onRescan: () => void;
};

const MODE_TABS: Array<{ id: DuplicatesCompareMode; label: string }> = [
  { id: 'sideBySide', label: 'Сравнение' },
  { id: 'overlay', label: 'Наложение' },
  { id: 'metadata', label: 'Детали' }
];

function pairKey(pair: ScannedDuplicatePair): string {
  return `${pair.cardIdA}:${pair.cardIdB}`;
}

function smallThumbRel(card: ScannedDuplicatePair['cardA']): string | null {
  if (!card) return null;
  return card.thumbSRelativePath ?? card.thumbRelativePath ?? card.thumbMRelativePath ?? card.originalRelativePath;
}

function StatusLabel({ status }: { status: DuplicatePairStatus }) {
  if (status === 'replaced') {
    return (
      <span className="arc-duplicates-row__status arc-duplicates-row__status--replaced">
        Заменено
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="arc-duplicates-row__status arc-duplicates-row__status--skipped">
        Пропущено
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M4 8h8M9 5l3 3-3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === 'notDuplicate') {
    return (
      <span className="arc-duplicates-row__status arc-duplicates-row__status--not-duplicate">
        Не дубли
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M5 5l6 6M11 5l-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return <span className="arc-duplicates-row__status arc-duplicates-row__status--queued">В очереди</span>;
}

export default function DuplicatesSidebar({
  scannedCards,
  duplicatesFound,
  spaceSavedBytes,
  mode,
  onModeChange,
  pairs,
  statuses,
  thumbUrls,
  selectedIndex,
  onSelectPair,
  onDismissPair,
  onRescan
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, []);
  return (
    <aside
      ref={rootRef}
      className="arc-duplicates-sidebar panel elevation-sunken arc-ui-kit-scope"
      data-elevation="sunken"
      data-btn-size="m"
    >
      <div className="arc-duplicates-sidebar__scanned">
        <div className="arc-duplicates-sidebar__stat">
          <span className="typo-p-m arc-duplicates-sidebar__stat-label">Карточек просканировано</span>
          <span className="typo-p-m arc-duplicates-sidebar__stat-value">
            {scannedCards.toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="arc-duplicates-sidebar__stat">
          <span className="typo-p-m arc-duplicates-sidebar__stat-label">Дублей найдено</span>
          <span className="typo-p-m arc-duplicates-sidebar__stat-value">
            {duplicatesFound.toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="arc-duplicates-sidebar__stat">
          <span className="typo-p-m arc-duplicates-sidebar__stat-label">Слияние сэкономит</span>
          <span className="typo-p-m arc-duplicates-sidebar__stat-value">{formatBytes(spaceSavedBytes)}</span>
        </div>
      </div>

      <div className="arc-duplicates-sidebar__modes-block">
        <span className="typo-p-s arc-duplicates-sidebar__modes-label">Режим сравнения</span>
        <div className="tabs arc-duplicates-modes" role="tablist" aria-label="Режим сравнения">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              className={`tab-button${mode === tab.id ? ' is-active' : ''}`}
              onClick={() => onModeChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="context-menu__sep" role="separator" aria-hidden="true" />

      <div className="arc-duplicates-sidebar__list">
        {pairs.map((pair, index) => {
          const key = pairKey(pair);
          const status = statuses[key] ?? 'queued';
          const resolved = status !== 'queued';
          const relA = smallThumbRel(pair.cardA);
          const relB = smallThumbRel(pair.cardB);
          const urlA = relA ? thumbUrls[relA] : undefined;
          const urlB = relB ? thumbUrls[relB] : undefined;
          return (
            <div
              key={key}
              className={`arc-duplicates-row${index === selectedIndex ? ' is-selected' : ''}${
                resolved ? ' is-resolved' : ''
              }`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectPair(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPair(index);
                }
              }}
            >
              <div className="arc-duplicates-row__thumbs">
                <span className="arc-duplicates-row__thumb">
                  {urlA ? <img src={urlA} alt="" /> : null}
                </span>
                <span className="arc-duplicates-row__thumb">
                  {urlB ? <img src={urlB} alt="" /> : null}
                </span>
              </div>
              <div className="arc-duplicates-row__body">
                <p className="typo-p-m arc-duplicates-row__sim">{Math.round(pair.similarity)}% Похожесть</p>
                <StatusLabel status={status} />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon-only btn-ds arc-ui-kit-scope arc-duplicates-row__dismiss"
                data-btn-size="s"
                data-elevation="sunken"
                aria-label="Убрать пару из списка"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissPair(index);
                }}
              >
                <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="arc-duplicates-sidebar__foot">
        <div className="context-menu__sep" role="separator" aria-hidden="true" />
        <button type="button" className="btn btn-outline btn-ds arc-duplicates-sidebar__rescan" onClick={onRescan}>
          <span className="btn-ds__icon arc-icon-reuse" aria-hidden="true" />
          <span className="btn-ds__value">Повторить сканирование</span>
        </button>
      </div>
    </aside>
  );
}
