import ValueSlider from '../range-slider/ValueSlider';
import { duplicateSimilarityHint } from './duplicateSimilarityHint';

type Props = {
  threshold: number;
  onThresholdChange: (value: number) => void;
  onScan: () => void;
  busy?: boolean;
  noResultsNotice?: boolean;
};

export default function DuplicatesReadyState({
  threshold,
  onThresholdChange,
  onScan,
  busy = false,
  noResultsNotice = false
}: Props) {
  return (
    <div className="arc-duplicates-fill" data-btn-size="l">
      <div className="arc-duplicates-fill__body">
        <div className="arc-duplicates-fill__text">
          <h1 className="arc-duplicates-fill__title">Поиск дубликатов</h1>
          <p className="typo-p-m arc-duplicates-fill__subtitle">
            Найдите похожие изображения в вашей базе данных. Сканирование может занять несколько минут, в
            зависимости от объёма данных
          </p>
        </div>

        <div className="arc-duplicates-ready__control">
          <div className="arc-duplicates-ready__threshold-row">
            <span className="typo-p-m arc-duplicates-ready__threshold-label">Порог похожести</span>
            <span className="typo-p-m arc-duplicates-ready__threshold-value">{threshold}%</span>
          </div>
          <ValueSlider
            size="s"
            min={50}
            max={100}
            step={5}
            value={threshold}
            showValue={false}
            disabled={busy}
            onChange={onThresholdChange}
            ariaLabel="Порог похожести"
          />
          <p className="typo-p-s arc-duplicates-ready__hint">{duplicateSimilarityHint(threshold)}</p>
          {noResultsNotice ? (
            <p className="typo-p-m arc-duplicates-ready__notice">
              Совпадений не найдено. Попробуйте снизить порог похожести
            </p>
          ) : null}
        </div>

        <button type="button" className="btn btn-brand btn-ds" onClick={onScan} disabled={busy}>
          <span className="btn-ds__value">Найти дубли</span>
        </button>
      </div>
    </div>
  );
}
