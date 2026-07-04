type Props = {
  scannedCards: number;
  totalCards: number;
  duplicatesFound: number;
  etaMs: number | null;
  onStop: () => void;
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

export default function DuplicatesScanningState({
  scannedCards,
  totalCards,
  duplicatesFound,
  etaMs,
  onStop
}: Props) {
  const eta = formatEta(etaMs);
  return (
    <div className="arc-duplicates-fill" data-btn-size="l">
      <div className="arc-duplicates-fill__body">
        <div className="arc-duplicates-scanning__head">
          <h1 className="arc-duplicates-fill__title">Идёт поиск дубликатов</h1>
          <div className="arc-duplicates-scanning__stats">
            <div className="arc-duplicates-scanning__stat">
              <span className="typo-p-m arc-duplicates-scanning__stat-label">Карточек просканировано</span>
              <span className="typo-p-m arc-duplicates-scanning__stat-value">
                {formatCount(scannedCards)} из {formatCount(totalCards)}
              </span>
            </div>
            <div className="arc-duplicates-scanning__stat">
              <span className="typo-p-m arc-duplicates-scanning__stat-label">Дублей найдено</span>
              <span className="typo-p-m arc-duplicates-scanning__stat-value">{formatCount(duplicatesFound)}</span>
            </div>
            {eta ? (
              <div className="arc-duplicates-scanning__stat">
                <span className="typo-p-m arc-duplicates-scanning__stat-label">Осталось примерно</span>
                <span className="typo-p-m arc-duplicates-scanning__stat-value">{eta}</span>
              </div>
            ) : null}
          </div>
        </div>

        <button type="button" className="btn btn-secondary btn-ds" onClick={onStop}>
          <span className="btn-ds__value">Остановить поиск</span>
        </button>
      </div>
    </div>
  );
}
