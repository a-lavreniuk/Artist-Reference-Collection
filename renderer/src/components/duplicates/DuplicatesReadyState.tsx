import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ValueSlider from '../range-slider/ValueSlider';
import { duplicateSimilarityHint } from './duplicateSimilarityHint';
import type { LibraryListItem } from '../../hooks/useLibraries';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type ScanProgress = {
  scannedCards: number;
  totalCards: number;
  duplicatesFound: number;
  etaMs: number | null;
};

type Props = {
  threshold: number;
  onThresholdChange: (value: number) => void;
  onScan: () => void;
  onCancelScan?: () => void;
  scanning?: boolean;
  progress?: ScanProgress | null;
  libraries?: LibraryListItem[];
  selectedLibraryIds?: string[];
  onSelectedLibraryIdsChange?: (ids: string[]) => void;
};

function formatEta(etaMs: number | null): string | null {
  if (etaMs == null || !Number.isFinite(etaMs) || etaMs <= 0) return null;
  const totalSec = Math.round(etaMs / 1000);
  if (totalSec < 60) return `${totalSec} сек`;
  const min = Math.round(totalSec / 60);
  return `${min} мин`;
}

function formatCount(value: number): string {
  return value.toLocaleString('ru-RU');
}

const SCOPE_PLACEHOLDER = 'Выберите библиотеки';

export default function DuplicatesReadyState({
  threshold,
  onThresholdChange,
  onScan,
  onCancelScan,
  scanning = false,
  progress = null,
  libraries = [],
  selectedLibraryIds = [],
  onSelectedLibraryIdsChange
}: Props) {
  const eta = scanning && progress ? formatEta(progress.etaMs) : null;
  const showScope = libraries.length > 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const scopeInputRef = useRef<HTMLInputElement>(null);
  const skipFieldClickRef = useRef(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeQuery, setScopeQuery] = useState('');

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [scanning, showScope, scopeOpen, selectedLibraryIds]);

  const allSelected = showScope && selectedLibraryIds.length === libraries.length;
  const hasSelection = selectedLibraryIds.length > 0;
  const selectedLibraries = useMemo(
    () => libraries.filter((lib) => selectedLibraryIds.includes(lib.id)),
    [libraries, selectedLibraryIds]
  );
  const queryNorm = scopeQuery.trim().toLowerCase();
  const filteredLibraries = useMemo(
    () =>
      queryNorm
        ? libraries.filter((lib) => lib.name.toLowerCase().includes(queryNorm))
        : libraries,
    [libraries, queryNorm]
  );

  const openScopeMenu = () => setScopeOpen(true);
  const focusScopeInput = () => scopeInputRef.current?.focus();

  const toggleLibrary = (id: string) => {
    if (selectedLibraryIds.includes(id)) {
      onSelectedLibraryIdsChange?.(selectedLibraryIds.filter((item) => item !== id));
    } else {
      onSelectedLibraryIdsChange?.([...selectedLibraryIds, id]);
    }
    setScopeQuery('');
  };

  const removeLibrary = (id: string) => {
    onSelectedLibraryIdsChange?.(selectedLibraryIds.filter((item) => item !== id));
  };

  const scopeRows = useMemo<ContextMenuRow[]>(() => {
    if (!showScope) return [];
    const allIds = libraries.map((lib) => lib.id);
    const rows: ContextMenuRow[] = [];
    if (!queryNorm) {
      rows.push({
        type: 'item',
        key: 'all',
        label: 'Все библиотеки',
        selected: allSelected,
        closeOnSelect: false,
        onSelect: () => {
          onSelectedLibraryIdsChange?.(allIds);
          setScopeQuery('');
        }
      });
      rows.push({ type: 'separator', key: 'sep' });
    }
    for (const lib of filteredLibraries) {
      const selected = selectedLibraryIds.includes(lib.id);
      rows.push({
        type: 'item',
        key: lib.id,
        label: lib.name,
        selected,
        closeOnSelect: false,
        onSelect: () => {
          if (selected) {
            onSelectedLibraryIdsChange?.(selectedLibraryIds.filter((id) => id !== lib.id));
          } else {
            onSelectedLibraryIdsChange?.([...selectedLibraryIds, lib.id]);
          }
          setScopeQuery('');
        }
      });
    }
    return rows;
  }, [
    allSelected,
    filteredLibraries,
    libraries,
    onSelectedLibraryIdsChange,
    queryNorm,
    selectedLibraryIds,
    showScope
  ]);

  return (
    <div ref={rootRef} className="arc-duplicates-fill" data-btn-size="l">
      <div className="arc-duplicates-fill__body">
        <div className="arc-duplicates-fill__text">
          <h1 className="h1 arc-duplicates-fill__title">Поиск дубликатов</h1>
          {scanning && progress ? (
            <div className="arc-duplicates-scanning__stats">
              <div className="arc-duplicates-scanning__stat">
                <span className="text-m arc-duplicates-scanning__stat-label">Карточек просканировано</span>
                <span className="text-m arc-duplicates-scanning__stat-value">
                  {formatCount(progress.scannedCards)} из {formatCount(progress.totalCards)}
                </span>
              </div>
              <div className="arc-duplicates-scanning__stat">
                <span className="text-m arc-duplicates-scanning__stat-label">Дублей найдено</span>
                <span className="text-m arc-duplicates-scanning__stat-value">
                  {formatCount(progress.duplicatesFound)}
                </span>
              </div>
              {eta ? (
                <div className="arc-duplicates-scanning__stat">
                  <span className="text-m arc-duplicates-scanning__stat-label">Осталось примерно</span>
                  <span className="text-m arc-duplicates-scanning__stat-value">{eta}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-m arc-duplicates-fill__subtitle">
              Найдите похожие изображения в вашей библиотеке. Сканирование может занять несколько минут, в
              зависимости от объёма данных
            </p>
          )}
        </div>

        {showScope && !scanning ? (
          <div className="arc-duplicates-ready__control arc-duplicates-ready__scope">
            <div
              className={`field arc-ui-kit-scope arc-duplicates-ready__selector${hasSelection ? ' has-value' : ''}`}
              data-input-size="l"
            >
              <div
                ref={selectorRef}
                role="combobox"
                aria-expanded={scopeOpen}
                aria-haspopup="menu"
                aria-label="Библиотеки для поиска дублей"
                className="input input-multiselect input--size-l input-slots"
                onClick={(e) => {
                  if (skipFieldClickRef.current) {
                    skipFieldClickRef.current = false;
                    return;
                  }
                  if ((e.target as HTMLElement).closest('.chip')) return;
                  focusScopeInput();
                  openScopeMenu();
                }}
              >
                {selectedLibraries.map((lib) => (
                  <button
                    key={lib.id}
                    type="button"
                    className="chip chip-active"
                    aria-label={`Убрать ${lib.name}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      skipFieldClickRef.current = true;
                      window.setTimeout(() => {
                        skipFieldClickRef.current = false;
                      }, 0);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeLibrary(lib.id);
                    }}
                  >
                    <span>{lib.name}</span>
                    <span className="chip-remove" aria-hidden="true">
                      ✕
                    </span>
                  </button>
                ))}
                <input
                  ref={scopeInputRef}
                  className="search-inner slot-value"
                  type="text"
                  placeholder={hasSelection ? '' : SCOPE_PLACEHOLDER}
                  aria-label="Библиотеки для поиска дублей"
                  value={scopeQuery}
                  onChange={(e) => {
                    setScopeQuery(e.target.value);
                    openScopeMenu();
                  }}
                  onFocus={openScopeMenu}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && scopeQuery === '' && selectedLibraries.length > 0) {
                      e.preventDefault();
                      removeLibrary(selectedLibraries[selectedLibraries.length - 1].id);
                      openScopeMenu();
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const first = filteredLibraries[0];
                      if (first) toggleLibrary(first.id);
                      else openScopeMenu();
                    }
                  }}
                />
              </div>
              <ContextMenu
                open={scopeOpen}
                anchorRef={selectorRef}
                onClose={() => {
                  setScopeOpen(false);
                  setScopeQuery('');
                }}
                ariaLabel="Библиотеки для поиска дублей"
                anchorPlacement="belowAnchor"
                anchorAlign="start"
                menuWidth={350}
                rows={scopeRows}
              />
            </div>
          </div>
        ) : null}

        <div className="arc-duplicates-ready__control">
          <div className="arc-duplicates-ready__threshold-row">
            <span className="text-m arc-duplicates-ready__threshold-label">Порог похожести</span>
            <span className="text-m arc-duplicates-ready__threshold-value">{threshold}%</span>
          </div>
          <ValueSlider
            size="s"
            min={50}
            max={100}
            step={5}
            value={threshold}
            showValue={false}
            disabled={scanning}
            onChange={onThresholdChange}
            ariaLabel="Порог похожести"
          />
          <p className="text-s arc-duplicates-ready__hint">{duplicateSimilarityHint(threshold)}</p>
        </div>

        <div className="arc-duplicates-ready__actions">
          <button
            type="button"
            className="btn btn-brand btn-ds"
            onClick={onScan}
            disabled={scanning || (showScope && !hasSelection)}
            aria-busy={scanning}
          >
            {scanning ? <span className="arc-duplicates-ready__spinner" aria-hidden="true" /> : null}
            <span className="btn-ds__value">{scanning ? 'Ищем дубли' : 'Найти дубли'}</span>
            {scanning ? null : <span className="btn-ds__icon arc-icon-copy" aria-hidden="true" />}
          </button>
          {scanning ? (
            <button type="button" className="btn btn-outline btn-ds" onClick={onCancelScan}>
              <span className="btn-ds__value">Отмена</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
