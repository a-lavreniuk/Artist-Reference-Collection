import { useLayoutEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { Datepicker } from '../components/datepicker';
import Calendar, { type CalendarSelection } from '../components/calendar/Calendar';
import SettingsOptionCard from '../components/settings/SettingsOptionCard';
import AiModelCard from '../components/settings/AiModelCard';
import { Tooltip } from '../components/tooltip/Tooltip';
import { TagTooltipBody } from '../components/tooltip/TagTooltipBody';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';

/**
 * Product patterns missing from static Controls section:
 * Empty State, Tooltip, Datepicker/Calendar, Sidebar row, Settings option/AI cards.
 */
export default function UiKitProductPatternsDemo() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [optA, setOptA] = useState(true);
  const [optB, setOptB] = useState(false);
  const [model, setModel] = useState(true);
  const [dateValue, setDateValue] = useState<{ from: string; to?: string } | null>({
    from: '2025-06-12',
    to: '2025-06-18'
  });
  const [calSelection, setCalSelection] = useState<CalendarSelection>({
    from: '2025-06-12',
    to: '2025-06-18'
  });
  const [sidebarActive, setSidebarActive] = useState<'a' | 'b'>('a');

  useLayoutEffect(() => {
    if (sidebarRef.current) void hydrateArcNavbarIcons(sidebarRef.current);
  }, [sidebarActive]);

  return (
    <div className="stack">
      <div className="inputs-group">
        <div className="id-tag">EL-EMPTY-STATE-GROUP</div>
        <h3 className="h3">Empty State</h3>
        <div className="demo-row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div className="sample sample-wide" style={{ flex: '1 1 280px' }}>
            <div className="id-tag">EL-EMPTY-LIBRARY</div>
            <EmptyState
              {...EMPTY_STATE_COPY.libraryEmpty}
              elevation="sunken"
              onPrimaryAction={() => undefined}
            />
          </div>
          <div className="sample sample-wide" style={{ flex: '1 1 280px' }}>
            <div className="id-tag">EL-EMPTY-SEARCH</div>
            <EmptyState
              {...EMPTY_STATE_COPY.searchNoResults}
              elevation="sunken"
              onPrimaryAction={() => undefined}
            />
          </div>
          <div className="sample sample-wide" style={{ flex: '1 1 280px' }}>
            <div className="id-tag">EL-EMPTY-IN-DEV</div>
            <EmptyState {...EMPTY_STATE_COPY.inDevelopmentBoard} elevation="sunken" />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-TOOLTIP-GROUP</div>
        <h3 className="h3">Tooltip</h3>
        <div className="demo-row">
          <div className="sample">
            <div className="id-tag">EL-TOOLTIP-DEFAULT</div>
            <Tooltip content="Добавить в мудборд" delay={500} position="top">
              <button type="button" className="btn btn-ghost btn-ds btn-icon-only" aria-label="Добавить в мудборд">
                <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
          <div className="sample">
            <div className="id-tag">EL-TOOLTIP-RICH</div>
            <Tooltip
              content={
                <TagTooltipBody
                  description="Короткое описание метки для rich-подсказки"
                  imageDataUrl={undefined}
                />
              }
              variant="rich"
              delay={500}
              position="top"
            >
              <button type="button" className="btn btn-outline btn-ds">
                <span className="btn-ds__value">Rich tooltip</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-INP-GROUP-DATEPICKER</div>
        <h3 className="h3">Datepicker</h3>
        <div className="demo-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="sample">
            <div className="id-tag">EL-DATEPICKER-LIVE</div>
            <Datepicker
              size="m"
              mode="range"
              value={dateValue}
              onChange={setDateValue}
              aria-label="Диапазон дат"
            />
          </div>
          <div className="sample">
            <div className="id-tag">EL-DATEPICKER-ERROR</div>
            <Datepicker size="m" mode="single" value={null} error aria-label="Дата с ошибкой" />
          </div>
          <div className="sample">
            <div className="id-tag">EL-DATEPICKER-DISABLED</div>
            <Datepicker size="m" mode="range" value={dateValue} disabled aria-label="Дата disabled" />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-CALENDAR-GROUP</div>
        <h3 className="h3">Calendar</h3>
        <div className="sample">
          <div className="id-tag">EL-CALENDAR-RANGE</div>
          <Calendar mode="range" selection={calSelection} onSelectionChange={setCalSelection} />
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-SIDEBAR-ROW-GROUP</div>
        <h3 className="h3">Sidebar list row</h3>
        <div
          ref={sidebarRef}
          className="sample sample-wide"
          style={{ maxWidth: 320, padding: 'var(--s-2)', background: 'var(--elevation-sunken)' }}
        >
          <div className="id-tag">EL-SIDEBAR-ROW-STATES</div>
          <div className="context-menu__list">
            {(
              [
                { id: 'a' as const, name: 'Категория A', count: 12 },
                { id: 'b' as const, name: 'Категория B', count: 3 }
              ] as const
            ).map((row) => {
              const isActive = sidebarActive === row.id;
              return (
                <div
                  key={row.id}
                  className={`context-menu__item arc-tags-sidebar-row${isActive ? ' is-active' : ''}`}
                  role="presentation"
                >
                  <div className="context-menu__item-inner arc-tags-sidebar-row-inner">
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-select"
                      onClick={() => setSidebarActive(row.id)}
                    >
                      <span className="context-menu__item-label-cluster">
                        <span className="context-menu__item-label">{row.name}</span>
                      </span>
                      <span className="context-menu__item-counter">{row.count}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-edit"
                      aria-label={`Редактировать «${row.name}»`}
                    >
                      <span
                        className="context-menu__item-icon tab-icon arc-icon-edit"
                        data-arc-icon-size="m"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-SETTINGS-OPTION-CARD-GROUP</div>
        <h3 className="h3">Settings option card</h3>
        <div className="demo-row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div className="sample" style={{ flex: '1 1 240px' }}>
            <div className="id-tag">EL-OPTION-CARD-ON</div>
            <SettingsOptionCard
              variant="toggle"
              label="Включённая опция"
              description="Описание карточки опции в выбранном состоянии"
              checked={optA}
              onCheckedChange={setOptA}
            />
          </div>
          <div className="sample" style={{ flex: '1 1 240px' }}>
            <div className="id-tag">EL-OPTION-CARD-OFF</div>
            <SettingsOptionCard
              variant="checkbox"
              label="Выключенная опция"
              description="Наведите и проверьте focus-visible с клавиатуры"
              checked={optB}
              onCheckedChange={setOptB}
            />
          </div>
          <div className="sample" style={{ flex: '1 1 240px' }}>
            <div className="id-tag">EL-OPTION-CARD-DISABLED</div>
            <SettingsOptionCard
              variant="toggle"
              label="Недоступная опция"
              description="Состояние disabled"
              checked
              disabled
            />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-AI-MODEL-CARD-GROUP</div>
        <h3 className="h3">AI model card</h3>
        <div className="sample sample-wide" style={{ maxWidth: 420 }}>
          <div className="id-tag">EL-AI-MODEL-CARD</div>
          <AiModelCard
            variant="radio"
            label="Модель поиска"
            description="Карточка модели с выбором и действиями"
            checked={model}
            onCheckedChange={setModel}
            actions={
              <div className="btn-group btn-group-ds" data-btn-size="s">
                <button type="button" className="btn btn-secondary btn-ds">
                  <span className="btn-ds__value">Обновить</span>
                </button>
                <button type="button" className="btn btn-outline btn-ds">
                  <span className="btn-ds__value">Удалить</span>
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
