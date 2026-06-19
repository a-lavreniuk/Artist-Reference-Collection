import type { DiskBarSegment } from '../../utils/buildDiskBarModel';

type Props = {
  segments: DiskBarSegment[];
};

export default function StatisticsDiskBar({ segments }: Props) {
  return (
    <div className="arc-stats-disk-bar" aria-hidden="true">
      <div className="arc-stats-disk-bar__shell">
        <div className="arc-stats-disk-bar__track">
          {segments.map((segment) => {
            if (segment.bytes <= 0) return null;
            const isFree = segment.tone === 'free';
            return (
              <span
                key={segment.id}
                className={[
                  'arc-stats-disk-bar__segment',
                  `arc-stats-disk-bar__segment--${segment.tone}`,
                  isFree ? null : 'arc-stats-disk-bar__segment--occupied'
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ flexGrow: Math.max(segment.bytes, 1), flexBasis: 0 }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
