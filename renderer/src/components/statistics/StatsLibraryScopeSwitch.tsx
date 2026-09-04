import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from '../context-menu';
import ContextMenuItem from '../context-menu/ContextMenuItem';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { LibraryListItem } from '../../hooks/useLibraries';

type StatsScope = 'all' | string;

type Props = {
  libraries: LibraryListItem[];
  statsScope: StatsScope;
  onChange: (scope: StatsScope) => void;
};

type ScopeOption = { id: StatsScope; label: string };

function ScopeTabs({
  options,
  statsScope,
  onChange,
  groupRef
}: {
  options: ScopeOption[];
  statsScope: StatsScope;
  onChange: (scope: StatsScope) => void;
  groupRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={groupRef} className="tabs arc-stats-library-tabs" role="tablist" aria-label="Библиотеки">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`tab-button${statsScope === option.id ? ' is-active' : ''}`}
          role="tab"
          aria-selected={statsScope === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Переключатель библиотек в шапке статистики: табы как в истории или селектор при переполнении. */
export default function StatsLibraryScopeSwitch({ libraries, statsScope, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  const options = useMemo<ScopeOption[]>(
    () => [
      { id: 'all', label: 'Все библиотеки' },
      ...libraries.map((lib) => ({ id: lib.id, label: lib.name }))
    ],
    [libraries]
  );

  const selectedLabel = options.find((o) => o.id === statsScope)?.label ?? 'Все библиотеки';

  useLayoutEffect(() => {
    const host = hostRef.current;
    const title = titleRef.current;
    const measure = measureRef.current;
    if (!host || !title || !measure) return;

    const update = () => {
      const gap = Number.parseFloat(getComputedStyle(host).columnGap || getComputedStyle(host).gap) || 8;
      const available = host.clientWidth - title.getBoundingClientRect().width - gap;
      setOverflows(measure.scrollWidth > available + 1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [options]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [open, overflows, selectedLabel]);

  if (libraries.length <= 1) {
    return (
      <div className="arc-page-section-header">
        <div className="arc-page-section-header__row">
          <h1 className="h1 arc-page-section-header__title">Статистика</h1>
        </div>
        <div className="context-menu__sep" role="separator" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="arc-page-section-header arc-ui-kit-scope" data-btn-size="m" data-input-size="m">
      <div ref={hostRef} className="arc-page-section-header__row">
        <h1 ref={titleRef} className="h1 arc-page-section-header__title">
          Статистика
        </h1>
        <div className="arc-stats-library-measure" aria-hidden="true">
          <ScopeTabs options={options} statsScope={statsScope} onChange={onChange} groupRef={measureRef} />
        </div>
        {overflows ? (
          <div className={`field selector-field has-value arc-page-section-header__selector${open ? ' is-open' : ''}`}>
            <button
              ref={anchorRef}
              type="button"
              className="input pseudo-select input-slots"
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Библиотеки"
              onClick={() => setOpen((prev) => !prev)}
            >
              <span className="selector-value slot-value">{selectedLabel}</span>
              <span className="selector-actions slot-trailing">
                <span className="selector-caret arc-icon-chevron arc-selector-dropdown-caret" aria-hidden="true" />
              </span>
            </button>
            <ContextMenu
              open={open}
              anchorRef={anchorRef}
              onClose={() => setOpen(false)}
              ariaLabel="Библиотеки"
              anchorPlacement="belowAnchor"
              anchorAlign="end"
            >
              {options.map((option) => (
                <ContextMenuItem
                  key={option.id}
                  label={option.label}
                  selected={option.id === statsScope}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ContextMenu>
          </div>
        ) : (
          <ScopeTabs options={options} statsScope={statsScope} onChange={onChange} />
        )}
      </div>
      <div className="context-menu__sep" role="separator" aria-hidden="true" />
    </div>
  );
}
