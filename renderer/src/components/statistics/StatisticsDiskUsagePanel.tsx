import { formatBytesRoundedMbFigma } from '../../utils/formatBytes';
import type { DiskBarModel } from '../../utils/buildDiskBarModel';
import StatisticsDiskBar from './StatisticsDiskBar';
import StatisticsPanelHead from './StatisticsPanelHead';

type Props = {
  model: DiskBarModel | null;
};

export default function StatisticsDiskUsagePanel({ model }: Props) {
  if (!model || model.diskTotalBytes <= 0) {
    return (
      <section className="arc-stats-disk-panel panel">
        <StatisticsPanelHead>
          <p className="text-l arc-stats-disk-panel__title">Занимаемое место</p>
        </StatisticsPanelHead>
        <p className="hint">Данные о диске недоступны</p>
      </section>
    );
  }

  return (
    <section className="arc-stats-disk-panel panel">
      <StatisticsPanelHead>
        <p className="text-l arc-stats-disk-panel__title">Занимаемое место</p>
        <StatisticsDiskBar segments={model.segments} />
        <ul className="arc-stats-disk-panel__legend">
          {model.legend.map((item) => (
            <li key={item.id} className="arc-stats-disk-panel__legend-item">
              <span
                className={`arc-stats-disk-panel__legend-swatch arc-stats-disk-bar__segment--${item.tone}`}
                aria-hidden="true"
              />
              <span className="text-m arc-stats-disk-panel__legend-label">{item.label}</span>
              <span className="text-m arc-stats-disk-panel__legend-value">
                {formatBytesRoundedMbFigma(item.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </StatisticsPanelHead>

      <p className="arc-stats-disk-panel__footer">
        <span className="h3 arc-stats-disk-panel__footer-primary">
          {formatBytesRoundedMbFigma(model.libraryFolderBytes)}
        </span>
        <span className="h3 arc-stats-disk-panel__footer-secondary">
          из {formatBytesRoundedMbFigma(model.diskTotalBytes)} на диске {model.driveLabel}
        </span>
      </p>
    </section>
  );
}
