import ValueSlider from '../range-slider/ValueSlider';
import { duplicateSimilarityHint } from './duplicateSimilarityHint';

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
  /** Сканирование дублей (кнопка «Ищем дубли»). */
  scanning?: boolean;
  noResultsNotice?: boolean;
  progress?: ScanProgress | null;
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
  scanning = false,
  noResultsNotice = false,
  progress = null
}: Props) {
  const eta = scanning && progress ? formatEta(progress.etaMs) : null;

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
            <p className="text-m arc-duplicates-ready__notice">
              Совпадений не найдено. Попробуйте снизить порог похожести
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-brand btn-ds"
          onClick={onScan}
          disabled={scanning}
          aria-busy={scanning}
        >
          {scanning ? <span className="arc-duplicates-ready__spinner" aria-hidden="true" /> : null}
          <span className="btn-ds__value">{scanning ? 'Ищем дубли' : 'Найти дубли'}</span>
        </button>
      </div>
    </div>
  );
}
