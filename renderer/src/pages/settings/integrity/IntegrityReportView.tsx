import type { ReactNode } from 'react';
import type { IntegrityReport } from '../../../services/libraryIntegrity';
import IntegritySummaryBar from './IntegritySummaryBar';
import IntegrityIssueRow from './IntegrityIssueRow';
import IntegrityOrphanList from './IntegrityOrphanList';
import IntegrityDuplicateGroup from './IntegrityDuplicateGroup';

type Props = {
  report: IntegrityReport;
  libraryRootAbs: string | null;
  busy: boolean;
  fileBackend: boolean | null;
  onFixMetadata: () => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteOrphan: (relPath: string) => void;
  onDeleteAllOrphans: (paths: string[]) => void;
  onShowOrphanInFolder: (relPath: string) => void;
  onRemoveInvalidRows: (indices: number[]) => void;
};

function dedupeMissingByCard(report: IntegrityReport): Map<string, { detail: string; paths: string[] }> {
  const map = new Map<string, { detail: string; paths: string[] }>();
  for (const item of report.grouped.missingFiles) {
    const cardId = item.cardId ?? 'unknown';
    const existing = map.get(cardId);
    const path = item.path;
    if (existing) {
      if (path && !existing.paths.includes(path)) existing.paths.push(path);
      continue;
    }
    map.set(cardId, {
      detail: `Карточка ${cardId}: отсутствуют файлы`,
      paths: path ? [path] : []
    });
  }
  return map;
}

export default function IntegrityReportView({
  report,
  libraryRootAbs,
  busy,
  fileBackend,
  onFixMetadata,
  onDeleteCard,
  onDeleteOrphan,
  onDeleteAllOrphans,
  onShowOrphanInFolder,
  onRemoveInvalidRows
}: Props) {
  const { grouped, isClean } = report;
  const missingByCard = dedupeMissingByCard(report);
  const metadataDisabled = busy || fileBackend === false;
  const invalidIndices = grouped.invalidRows
    .map((r) => r.cardIndex)
    .filter((i): i is number => typeof i === 'number');

  const hasSections =
    grouped.metadata.length > 0 ||
    missingByCard.size > 0 ||
    grouped.duplicatePaths.length > 0 ||
    grouped.orphanPaths.length > 0 ||
    grouped.critical.length > 0 ||
    grouped.invalidRows.length > 0;

  return (
    <div className="arc-integrity-screen">
      <IntegritySummaryBar report={report} />

      {!isClean && hasSections ? (
        <div className="arc-integrity-sections">
          {grouped.metadata.length > 0 ? (
            <section className="arc-integrity-section panel elevation-default">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Метаданные</h2>
                <p className="text-m arc-integrity-section__hint">
                  Битые ссылки на метки, коллекции, счётчики и мудборд
                </p>
              </header>
              <ul className="arc-integrity-section__list">
                {grouped.metadata.map((item, idx) => (
                  <li key={`${item.code}-${idx}`}>
                    <IntegrityIssueRow detail={item.detail} />
                  </li>
                ))}
              </ul>
              <div className="arc-integrity-section__actions">
                <button
                  type="button"
                  className="btn btn-brand btn-ds"
                  disabled={metadataDisabled}
                  onClick={onFixMetadata}
                >
                  <span className="btn-ds__value">Исправить метаданные</span>
                </button>
                {fileBackend === false ? (
                  <p className="text-s arc-integrity-section__note">Доступно только для файловой библиотеки</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {missingByCard.size > 0 ? (
            <section className="arc-integrity-section panel elevation-default">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Отсутствующие файлы</h2>
                <p className="text-m arc-integrity-section__hint">
                  Файлы на диске не найдены — карточку можно удалить
                </p>
              </header>
              <ul className="arc-integrity-section__list">
                {[...missingByCard.entries()].map(([cardId, { detail, paths }]) => (
                  <li key={cardId}>
                    <IntegrityIssueRow detail={detail} path={paths.join(', ') || undefined}>
                      <button
                        type="button"
                        className="btn btn-danger btn-ds"
                        disabled={busy}
                        onClick={() => onDeleteCard(cardId)}
                      >
                        <span className="btn-ds__value">Удалить карточку</span>
                      </button>
                    </IntegrityIssueRow>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {grouped.duplicatePaths.length > 0 ? (
            <section className="arc-integrity-section panel elevation-default">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Дубликаты путей</h2>
                <p className="text-m arc-integrity-section__hint">
                  Несколько карточек ссылаются на один файл — удалите лишние
                </p>
              </header>
              <div className="arc-integrity-section__groups">
                {grouped.duplicatePaths.map((item, idx) =>
                  item.cardIds && item.path ? (
                    <IntegrityDuplicateGroup
                      key={`${item.code}-${item.path}-${idx}`}
                      cardIds={item.cardIds}
                      path={item.path}
                      libraryRootAbs={libraryRootAbs}
                      busy={busy}
                      onDeleteCard={onDeleteCard}
                    />
                  ) : (
                    <IntegrityIssueRow key={`${item.code}-${idx}`} detail={item.detail} />
                  )
                )}
              </div>
            </section>
          ) : null}

          {grouped.orphanPaths.length > 0 ? (
            <section className="arc-integrity-section panel elevation-default">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Лишние файлы</h2>
                <p className="text-m arc-integrity-section__hint">
                  Файлы на диске не привязаны ни к одной карточке
                </p>
              </header>
              <IntegrityOrphanList
                paths={grouped.orphanPaths}
                libraryRootAbs={libraryRootAbs}
                busy={busy}
                onDelete={onDeleteOrphan}
                onDeleteAll={onDeleteAllOrphans}
                onShowInFolder={onShowOrphanInFolder}
              />
            </section>
          ) : null}

          {grouped.invalidRows.length > 0 ? (
            <section className="arc-integrity-section panel elevation-default">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Битые записи карточек</h2>
              </header>
              <ul className="arc-integrity-section__list">
                {grouped.invalidRows.map((item, idx) => (
                  <li key={`invalid-${item.cardIndex ?? idx}`}>
                    <IntegrityIssueRow detail={item.detail} />
                  </li>
                ))}
              </ul>
              <div className="arc-integrity-section__actions">
                <button
                  type="button"
                  className="btn btn-danger btn-ds"
                  disabled={metadataDisabled || invalidIndices.length === 0}
                  onClick={() => onRemoveInvalidRows(invalidIndices)}
                >
                  <span className="btn-ds__value">Удалить битые записи</span>
                </button>
              </div>
            </section>
          ) : null}

          {grouped.critical.length > 0 ? (
            <section className="arc-integrity-section panel elevation-default arc-integrity-section--critical">
              <header className="arc-integrity-section__head">
                <h2 className="text-m arc-integrity-section__title">Критические ошибки</h2>
                <p className="text-m arc-integrity-section__hint">
                  Повторяющиеся id в метаданных — автоматически не исправляется. Обратитесь в поддержку, если
                  проблема сохраняется.
                </p>
              </header>
              <ul className="arc-integrity-section__list">
                {grouped.critical.map((item, idx) => (
                  <li key={`${item.code}-${idx}`}>
                    <IntegrityIssueRow detail={item.detail} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
