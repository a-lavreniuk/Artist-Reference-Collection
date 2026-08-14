import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components/empty-state';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import type { HistoryEntry } from '../../services/historyTypes';
import ConfirmClearHistoryModal from './ConfirmClearHistoryModal';
import { formatHistoryDisplayTime } from './formatHistoryDisplayTime';
import HistoryMessage from './HistoryMessage';
import {
  HISTORY_OVERSCAN,
  HISTORY_ROW_ESTIMATE_PX,
  HISTORY_VIRTUALIZE_AFTER,
  historyVisibleRange
} from './historyListWindow';

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

/** От большего периода к меньшему: вся история → месяц → неделя → сегодня. */
const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Вся история' },
  { key: 'month', label: 'За месяц' },
  { key: 'week', label: 'За неделю' },
  { key: 'today', label: 'Сегодня' }
];

function HistoryEntriesList({ entries }: { entries: HistoryEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLLIElement>(null);
  const [rowHeight, setRowHeight] = useState(HISTORY_ROW_ESTIMATE_PX);
  const [range, setRange] = useState(() =>
    entries.length > HISTORY_VIRTUALIZE_AFTER
      ? historyVisibleRange(entries.length, 0, 800, HISTORY_ROW_ESTIMATE_PX, HISTORY_OVERSCAN)
      : { start: 0, end: entries.length }
  );
  const virtualize = entries.length > HISTORY_VIRTUALIZE_AFTER;

  useLayoutEffect(() => {
    if (!virtualize) return;
    const el = measureRef.current;
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h > 0 && Math.abs(h - rowHeight) > 1) setRowHeight(h);
  }, [virtualize, range.start, entries, rowHeight]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!virtualize || !root) {
      setRange({ start: 0, end: entries.length });
      return;
    }
    const update = () => {
      const next = historyVisibleRange(
        entries.length,
        root.scrollTop,
        root.clientHeight,
        rowHeight,
        HISTORY_OVERSCAN
      );
      setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    root.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => {
      root.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [entries.length, rowHeight, virtualize]);

  const sliceStart = virtualize ? range.start : 0;
  const sliceEnd = virtualize ? range.end : entries.length;

  return (
    <div className="arc-history-scroll" ref={scrollRef}>
      <ul className="arc-history-list" aria-live="polite">
        {virtualize && sliceStart > 0 ? (
          <li className="arc-history-list__spacer" style={{ height: sliceStart * rowHeight }} aria-hidden />
        ) : null}
        {entries.slice(sliceStart, sliceEnd).map((entry, offset) => {
          const index = sliceStart + offset;
          return (
            <li
              key={`${entry.time}-${index}`}
              className="arc-history-list__item"
              ref={offset === 0 ? measureRef : undefined}
            >
              {index > 0 ? <div className="arc-history-row-sep" role="separator" /> : null}
              <div className="arc-history-item">
                <span className="text-m arc-history-time">{formatHistoryDisplayTime(entry.time)}</span>
                <HistoryMessage entry={entry} />
              </div>
            </li>
          );
        })}
        {virtualize && sliceEnd < entries.length ? (
          <li
            className="arc-history-list__spacer"
            style={{ height: (entries.length - sliceEnd) * rowHeight }}
            aria-hidden
          />
        ) : null}
      </ul>
    </div>
  );
}

export default function SettingsHistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [clearOpen, setClearOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      if (!window.arc?.readHistory) {
        setEntries([]);
        return;
      }
      setEntries(await window.arc.readHistory());
    } finally {
      setLoading(false);
    }
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
    setFilter('all');
  };

  const isJournalEmpty = entries.length === 0;
  const isFilterEmpty = !isJournalEmpty && filtered.length === 0;

  if (loading) {
    return <div className="arc-settings-stack arc-history-screen" data-interface-tour-anchor="history-main" />;
  }

  if (isJournalEmpty) {
    return (
      <div className="arc-settings-stack arc-history-screen" data-interface-tour-anchor="history-main">
        <div className="arc-history-empty-host">
          <EmptyState {...EMPTY_STATE_COPY.historyEmpty} fill />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="arc-settings-stack arc-history-screen" data-interface-tour-anchor="history-main">
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

          {isFilterEmpty ? (
            <div className="arc-history-scroll">
              <EmptyState {...EMPTY_STATE_COPY.historyFilterEmpty} fill />
            </div>
          ) : (
            <HistoryEntriesList key={filter} entries={filtered} />
          )}
        </section>
      </div>

      {clearOpen ? (
        <ConfirmClearHistoryModal onClose={() => setClearOpen(false)} onConfirm={handleClear} />
      ) : null}
    </>
  );
}
