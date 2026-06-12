import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DatepickerMode } from '../datepicker/dateRangeText';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CalendarDay, { type CalendarDayVisualState } from './CalendarDay';
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  buildYearOptions,
  getMonthGrid,
  isBetweenInclusive,
  parseIsoLocal,
  toIsoLocal
} from './calendarUtils';

export type CalendarSelection = {
  from: string | null;
  to: string | null;
};

type Props = {
  mode: DatepickerMode;
  selection: CalendarSelection;
  onSelectionChange: (next: CalendarSelection) => void;
};

function resolveRange(from: string, to: string | null, hoverIso: string | null): { from: string; to: string } | null {
  if (!from) return null;
  if (to) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (!hoverIso) return { from, to: from };
  return from <= hoverIso ? { from, to: hoverIso } : { from: hoverIso, to: from };
}

function getDayVisual(
  iso: string,
  inMonth: boolean,
  range: { from: string; to: string } | null,
  endpointFrom: string | null,
  endpointTo: string | null
): CalendarDayVisualState {
  if (!inMonth) return 'outdate';
  if (!range) return 'default';
  if (range.from === range.to && iso === range.from) return 'active';
  if (iso === endpointFrom && iso === endpointTo) return 'active';
  if (iso === endpointFrom) return 'range-start';
  if (iso === endpointTo) return 'range-end';
  if (isBetweenInclusive(iso, range.from, range.to)) return 'in-range';
  return 'default';
}

export default function Calendar({ mode, selection, onSelectionChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const monthFieldRef = useRef<HTMLDivElement>(null);
  const yearFieldRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState<'month' | 'year' | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);

  const initial = selection.from ? parseIsoLocal(selection.from) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const todayIso = useMemo(() => toIsoLocal(new Date()), []);
  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const activeRange = useMemo(
    () => resolveRange(selection.from ?? '', selection.to, hoverIso),
    [selection.from, selection.to, hoverIso]
  );

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [viewYear, viewMonth, openDropdown, selection.from, selection.to]);

  useEffect(() => {
    if (!openDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const monthInside = monthFieldRef.current?.contains(target) ?? false;
      const yearInside = yearFieldRef.current?.contains(target) ?? false;
      if (!monthInside && !yearInside) {
        setOpenDropdown(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [openDropdown]);

  const years = useMemo(() => buildYearOptions(viewYear), [viewYear]);

  const shiftMonth = (delta: number) => {
    setOpenDropdown(null);
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleDayClick = (iso: string) => {
    if (mode === 'single') {
      onSelectionChange({ from: iso, to: iso });
      return;
    }
    if (!selection.from || (selection.from && selection.to)) {
      onSelectionChange({ from: iso, to: null });
      return;
    }
    const from = selection.from;
    const to = iso;
    if (to < from) {
      onSelectionChange({ from: to, to: from });
      return;
    }
    onSelectionChange({ from, to });
  };

  return (
    <div
      ref={hostRef}
      className="arc-calendar arc-ui-kit-scope"
      data-elevation="raised"
      data-typo-tone="white"
      data-btn-size="s"
      data-input-size="s"
    >
      <div className="arc-calendar__options">
        <button
          type="button"
          className="btn btn-ghost btn-ds btn-icon-only btn-s arc-calendar__nav"
          aria-label="Предыдущий месяц"
          onClick={() => shiftMonth(-1)}
        >
          <span
            className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-left"
            data-arc-icon-size="s"
            aria-hidden="true"
          />
        </button>
        <div className="arc-calendar__selectors">
          <div
            ref={monthFieldRef}
            className={`field selector-field has-value arc-calendar__selector-field${openDropdown === 'month' ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="input pseudo-select input-slots arc-calendar__selector-trigger"
              aria-expanded={openDropdown === 'month'}
              onClick={() => setOpenDropdown((prev) => (prev === 'month' ? null : 'month'))}
            >
              <span className="selector-value slot-value arc-calendar__selector-label">{MONTH_LABELS[viewMonth]}</span>
              <span
                className="selector-caret slot-trailing arc-icon-chevron arc-selector-dropdown-caret"
                data-arc-icon-size="s"
                aria-hidden="true"
              />
            </button>
            <div className="selector-dropdown arc-calendar__selector-dropdown" hidden={openDropdown !== 'month'}>
              <div className="dropdown-list">
                {MONTH_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={`dropdown-row${index === viewMonth ? ' is-checked' : ''}`}
                    onClick={() => {
                      setViewMonth(index);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{label}</span>
                    <span className="dropdown-row-check tab-icon arc-icon-check" data-arc-icon-size="s" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            ref={yearFieldRef}
            className={`field selector-field has-value arc-calendar__selector-field${openDropdown === 'year' ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="input pseudo-select input-slots arc-calendar__selector-trigger"
              aria-expanded={openDropdown === 'year'}
              onClick={() => setOpenDropdown((prev) => (prev === 'year' ? null : 'year'))}
            >
              <span className="selector-value slot-value arc-calendar__selector-label">{viewYear}</span>
              <span
                className="selector-caret slot-trailing arc-icon-chevron arc-selector-dropdown-caret"
                data-arc-icon-size="s"
                aria-hidden="true"
              />
            </button>
            <div className="selector-dropdown arc-calendar__selector-dropdown" hidden={openDropdown !== 'year'}>
              <div className="dropdown-list">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={`dropdown-row${year === viewYear ? ' is-checked' : ''}`}
                    onClick={() => {
                      setViewYear(year);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{year}</span>
                    <span className="dropdown-row-check tab-icon arc-icon-check" data-arc-icon-size="s" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-ds btn-icon-only btn-s arc-calendar__nav"
          aria-label="Следующий месяц"
          onClick={() => shiftMonth(1)}
        >
          <span
            className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-right"
            data-arc-icon-size="s"
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="arc-calendar__days" role="grid" aria-label="Календарь">
        {WEEKDAY_LABELS.map((label, index) => (
          <CalendarDay
            key={label}
            day={0}
            visual="default"
            isHeader
            label={label}
            isWeekendLabel={index >= 5}
          />
        ))}
        {cells.map((cell) => {
          const visual = getDayVisual(
            cell.iso,
            cell.inMonth,
            activeRange,
            selection.from,
            selection.to ?? selection.from
          );
          return (
            <CalendarDay
              key={cell.iso}
              day={cell.date.getDate()}
              visual={visual}
              isCurrentDay={cell.iso === todayIso}
              disabled={!cell.inMonth}
              onClick={() => {
                if (!cell.inMonth) return;
                handleDayClick(cell.iso);
              }}
              onMouseEnter={() => {
                if (!cell.inMonth) return;
                setHoverIso(cell.iso);
              }}
              onMouseLeave={() => setHoverIso(null)}
            />
          );
        })}
      </div>
    </div>
  );
}
