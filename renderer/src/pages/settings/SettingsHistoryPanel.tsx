import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/empty-state';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import type { HistoryEntry } from '../../services/historyTypes';
import ConfirmClearHistoryModal from './ConfirmClearHistoryModal';
import { formatHistoryDisplayTime } from './formatHistoryDisplayTime';
import HistoryMessage from './HistoryMessage';

type FilterKey = 'today' | 'week' | 'month' | 'all';

function parseLocalEntryTime(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(): Date {
  const d = startOfToday();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'За неделю' },
  { key: 'month', label: 'За месяц' },
  { key: 'all', label: 'Вся история' }
];

export default function SettingsHistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('today');
  const [clearOpen, setClearOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!window.arc?.readHistory) {
      setEntries([]);
      return;
    }
    setEntries(await window.arc.readHistory());
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filtered = useMemo(() => {
    const now = new Date();
    const t0 =
      filter === 'today'
        ? startOfToday()
        : filter === 'week'
          ? startOfWeekMonday()
          : filter === 'month'
            ? startOfMonth()
            : null;
    return entries.filter((e) => {
      const d = parseLocalEntryTime(e.time);
      if (!d) return filter === 'all';
      if (filter === 'all') return true;
      if (!t0) return true;
      return d >= t0 && d <= now;
    });
  }, [entries, filter]);

  const handleClear = async () => {
    await window.arc?.clearHistory?.();
    setEntries([]);
  };

  const isJournalEmpty = entries.length === 0;
  const isFilterEmpty = !isJournalEmpty && filtered.length === 0;
  const showEmptySection = isJournalEmpty || isFilterEmpty;

  const emptyCopy = isJournalEmpty ? EMPTY_STATE_COPY.historyEmpty : EMPTY_STATE_COPY.historyFilterEmpty;

  return (
    <>
      <div className="arc-settings-stack arc-history-screen">
        {showEmptySection ? (
          <div className="arc-history-empty-host">
            <EmptyState
              {...emptyCopy}
              fill
              onPrimaryAction={isFilterEmpty ? () => setFilter('all') : undefined}
            />
          </div>
        ) : (
          <section className="panel elevation-sunken arc-history-container" aria-label="История действий">
            <div className="arc-history-toolbar">
              <div className="tabs arc-history-tabs" role="tablist" aria-label="Период истории">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`tab-button${filter === t.key ? ' is-active' : ''}`}
                    role="tab"
                    aria-selected={filter === t.key}
                    onClick={() => setFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-danger btn-ds" onClick={() => setClearOpen(true)}>
                <span className="btn-ds__value">Очистить</span>
              </button>
            </div>

            <div className="arc-history-fullbleed-sep" role="separator" />

            <div className="arc-history-scroll">
              <ul className="arc-history-list" aria-live="polite">
                {filtered.map((e, i) => (
                  <li key={`${e.time}-${i}`} className="arc-history-list__item">
                    {i > 0 ? <div className="arc-history-row-sep" role="separator" /> : null}
                    <div className="arc-history-item">
                      <span className="typo-p-m arc-history-time">{formatHistoryDisplayTime(e.time)}</span>
                      <HistoryMessage entry={e} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      {clearOpen ? (
        <ConfirmClearHistoryModal onClose={() => setClearOpen(false)} onConfirm={handleClear} />
      ) : null}
    </>
  );
}
