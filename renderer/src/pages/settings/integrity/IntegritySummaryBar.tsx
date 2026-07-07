import type { IntegrityReport } from '../../../services/libraryIntegrity';

type Props = {
  report: IntegrityReport;
};

export default function IntegritySummaryBar({ report }: Props) {
  const { errorCount, warningCount, isClean } = report;

  if (isClean) {
    return (
      <p className="text-m arc-integrity-summary__text arc-integrity-summary__text--ok">Проблем не найдено</p>
    );
  }

  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(`${errorCount} ${pluralize(errorCount, 'ошибка', 'ошибки', 'ошибок')}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} ${pluralize(warningCount, 'предупреждение', 'предупреждения', 'предупреждений')}`);
  }

  return <p className="text-m arc-integrity-summary__text">{parts.join(', ')}</p>;
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
