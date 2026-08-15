import ValueSlider from '../range-slider/ValueSlider';
import { duplicateSimilarityHint } from './duplicateSimilarityHint';
import SettingsCheckboxRow from '../settings/SettingsCheckboxRow';
import { EmptyState } from '../empty-state';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import type { LibraryListItem } from '../../hooks/useLibraries';

type ScanProgress = {
  scannedCards: number;
  totalCards: number;
  duplicatesFound: number;
  etaMs: number | null;
};

export type DuplicatesScanScopeMode = 'current' | 'all' | 'ids';

type Props = {
  threshold: number;
  onThresholdChange: (value: number) => void;
  onScan: () => void;
  onCancelScan?: () => void;
  scanning?: boolean;
  noResultsNotice?: boolean;
  progress?: ScanProgress | null;
  libraries?: LibraryListItem[];
  scopeMode?: DuplicatesScanScopeMode;
  onScopeModeChange?: (mode: DuplicatesScanScopeMode) => void;
  selectedLibraryIds?: string[];
  onToggleLibraryId?: (libraryId: string) => void;
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

export default function DuplicatesReadyState({
  threshold,
  onThresholdChange,
  onScan,
  onCancelScan,
  scanning = false,
  noResultsNotice = false,
  progress = null,
  libraries = [],
  scopeMode = 'current',
  onScopeModeChange,
  selectedLibraryIds = [],
  onToggleLibraryId
}: Props) {
  const eta = scanning && progress ? formatEta(progress.etaMs) : null;
  const showScope = libraries.length > 1;

  return (
    <div className="arc-duplicates-fill" data-btn-size="l">
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
              Найдите похожие изображения в вашей базе данных. Сканирование может занять несколько минут, в
              зависимости от объёма данных
            </p>
          )}
        </div>

        {showScope && !scanning ? (
          <div className="arc-duplicates-ready__control">
            <div className="tabs arc-stats-library-tabs arc-ui-kit-scope" data-btn-size="m" role="tablist" aria-label="Область поиска">
              <button
                type="button"
                role="tab"
                className={`tab-button${scopeMode === 'current' ? ' is-active' : ''}`}
                aria-selected={scopeMode === 'current'}
                onClick={() => onScopeModeChange?.('current')}
              >
                <span className="tab-button__label">Текущая</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`tab-button${scopeMode === 'all' ? ' is-active' : ''}`}
                aria-selected={scopeMode === 'all'}
                onClick={() => onScopeModeChange?.('all')}
              >
                <span className="tab-button__label">Все</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`tab-button${scopeMode === 'ids' ? ' is-active' : ''}`}
                aria-selected={scopeMode === 'ids'}
                onClick={() => onScopeModeChange?.('ids')}
              >
                <span className="tab-button__label">Выбрать</span>
              </button>
            </div>
            {scopeMode === 'all' ? (
              <p className="text-s hint arc-stats-library-hint">
                В результатах будут и пары внутри каждой библиотеки, и совпадения между ними
              </p>
            ) : null}
            {scopeMode === 'ids' ? (
              <div className="arc-ui-kit-scope" data-btn-size="m">
                {libraries.map((lib) => (
                  <SettingsCheckboxRow
                    key={lib.id}
                    label={lib.name}
                    checked={selectedLibraryIds.includes(lib.id)}
                    onCheckedChange={() => onToggleLibraryId?.(lib.id)}
                  />
                ))}
              </div>
            ) : null}
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
          {noResultsNotice && !scanning ? (
            <EmptyState {...EMPTY_STATE_COPY.duplicatesNoResults} elevation="sunken" />
          ) : null}
        </div>

        <div className="arc-duplicates-ready__actions">
          <button
            type="button"
            className="btn btn-brand btn-ds"
            onClick={onScan}
            disabled={scanning || (scopeMode === 'ids' && selectedLibraryIds.length === 0)}
            aria-busy={scanning}
          >
            {scanning ? <span className="arc-duplicates-ready__spinner" aria-hidden="true" /> : null}
            <span className="btn-ds__value">{scanning ? 'Ищем дубли' : 'Найти дубли'}</span>
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
