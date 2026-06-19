import { formatBytesRoundedMbFigma } from '../../utils/formatBytes';
import type { DiskBarModel } from '../../utils/buildDiskBarModel';
import { evaluateDiskSpacePressure } from '../../utils/evaluateDiskSpacePressure';
import StatisticsDiskBar from './StatisticsDiskBar';
import StatisticsDiskSpaceNotice from './StatisticsDiskSpaceNotice';
import StatisticsPanelHead from './StatisticsPanelHead';

type Props = {
  model: DiskBarModel | null;
};

export default function StatisticsDiskUsagePanel({ model }: Props) {
  if (!model || model.diskTotalBytes <= 0) {
    return (
      <section className="arc-stats-disk-panel panel">
        <StatisticsPanelHead
          icon={<span className="arc-stat-icon arc-stat-icon--hard-drive" aria-hidden="true" />}
        >
          <p className="typo-p-l arc-stats-disk-panel__title">Занимаемое место</p>
        </StatisticsPanelHead>
        <p className="hint">Данные о диске недоступны</p>
      </section>
    );
  }

  const pressureAdvice = evaluateDiskSpacePressure({
    diskTotalBytes: model.diskTotalBytes,
    diskFreeBytes: model.diskFreeBytes,
    libraryFolderBytes: model.libraryFolderBytes
  });

  return (
    <section className="arc-stats-disk-panel panel">
      <StatisticsPanelHead
        icon={<span className="arc-stat-icon arc-stat-icon--hard-drive" aria-hidden="true" />}
      >
        <p className="typo-p-l arc-stats-disk-panel__title">Занимаемое место</p>
        <StatisticsDiskBar segments={model.segments} />
        <ul className="arc-stats-disk-panel__legend">
          {model.legend.map((item) => (
            <li key={item.id} className="arc-stats-disk-panel__legend-item">
              <span
                className={`arc-stats-disk-panel__legend-swatch arc-stats-disk-bar__segment--${item.tone}`}
                aria-hidden="true"
              />
              <span className="typo-p-m">{item.label}</span>
              <span className="typo-p-m arc-stats-disk-panel__legend-value">
                {formatBytesRoundedMbFigma(item.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </StatisticsPanelHead>

      {pressureAdvice ? <StatisticsDiskSpaceNotice advice={pressureAdvice} /> : null}

      <p className="arc-stats-disk-panel__footer">
        <span className="h3">{formatBytesRoundedMbFigma(model.libraryFolderBytes)}</span>
        <span className="h3 arc-stats-disk-panel__footer-secondary">
          из {formatBytesRoundedMbFigma(model.diskTotalBytes)} на диске {model.driveLabel}
        </span>
      </p>
    </section>
  );
}
